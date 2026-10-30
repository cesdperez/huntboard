import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser } from '../db/users.js';
import { memoryCookies } from '../testing/memory-cookies.js';
import { MAX_CODE_ATTEMPTS } from '../use-cases/email-sign-in.js';

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock('../http/session.js', () => ({ signIn: mocks.signIn }));

import { NAME_ERROR, emailSignInActions, linkSignInAction, pendingEmail } from './email-sign-in.js';

let env: { DB: D1Database; RESEND_API_KEY: string; EMAIL_FROM: string };

beforeEach(() => {
	vi.clearAllMocks();
	env = { DB: createTestDb(), RESEND_API_KEY: '', EMAIL_FROM: 'Huntboard <a@example.com>' };
});

type AnyAction = (event: never) => unknown;

/** Runs an action like SvelteKit does: a returned value, or a thrown redirect. */
async function run(
	action: AnyAction,
	fields: Record<string, string>,
	{ jar = new Map<string, string>(), query = '' } = {}
) {
	const { cookies } = memoryCookies(Object.fromEntries(jar));
	const request = new Request(`https://huntboard.example/login${query}`, {
		method: 'POST',
		body: new URLSearchParams(fields)
	});
	const event = { request, cookies, url: new URL(request.url) };
	type Outcome = {
		result?: { status?: number; data?: Record<string, unknown> };
		thrown?: { status: number; location: string };
	};
	const outcome: Outcome = await Promise.resolve(action(event as never)).then(
		(result) => ({ result: result as Outcome['result'] }),
		(thrown: Outcome['thrown']) => ({ thrown })
	);
	return { ...outcome, cookies };
}

/** Asks for an email in preview mode and returns the cookie jar holding the request. */
async function requested(email: string, earlier = new Map<string, string>()) {
	const { result, cookies } = await run(
		emailSignInActions(env, true).request,
		{ email },
		{ jar: earlier, query: '?/request&next=%2Fnew' }
	);
	const jar = new Map([['sign_in_request', cookies.get('sign_in_request') ?? '']]);
	const { link, code } = (result as unknown as { preview: { link: string; code: string } }).preview;
	return { jar, link, code };
}

describe('request', () => {
	it('shows the link and code only in preview mode, when no email was sent', async () => {
		const { result } = await run(emailSignInActions(env, true).request, {
			email: 'sam@example.com'
		});

		expect(result).toMatchObject({
			sent: 'sam@example.com',
			preview: { link: expect.stringContaining('/login/verify?token='), code: expect.any(String) }
		});
	});

	it('is unavailable outside preview mode without an email provider', async () => {
		const { result } = await run(emailSignInActions(env, false).request, {
			email: 'sam@example.com'
		});

		expect(result).toMatchObject({ status: 503 });
	});

	it('sends through Resend without showing the link', async () => {
		env.RESEND_API_KEY = 're_test';
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{}', { status: 200 }));

		const { result } = await run(emailSignInActions(env, true).request, {
			email: 'sam@example.com'
		});

		expect(fetchSpy).toHaveBeenCalledOnce();
		expect(result).toEqual({ sent: 'sam@example.com', preview: null });
		fetchSpy.mockRestore();
	});

	it('keeps the typed address with an error', async () => {
		const { result } = await run(emailSignInActions(env, true).request, { email: 'sam' });

		expect(result).toMatchObject({
			status: 400,
			data: { email: 'sam', error: expect.any(String) }
		});
	});
});

describe('code', () => {
	it('signs in and goes to next with the right code from this browser', async () => {
		const sam = await findOrCreateUser(env.DB, 'sam@example.com', 'Sam');
		const { jar, code } = await requested('sam@example.com');

		const { thrown, cookies } = await run(emailSignInActions(env, true).code, { code }, { jar });

		expect(thrown).toMatchObject({ status: 303, location: '/new' });
		expect(mocks.signIn).toHaveBeenCalledWith(expect.anything(), sam.id);
		expect(cookies.get('sign_in_request')).toBeUndefined();
	});

	it('asks a new address for a name, then complains only once a name was sent', async () => {
		const { jar, code } = await requested('new@example.com');
		const actions = emailSignInActions(env, true);

		expect((await run(actions.code, { code }, { jar })).result).toMatchObject({
			status: 400,
			data: { needsName: true, code, error: null, nameError: null }
		});
		expect((await run(actions.code, { code, displayName: ' ' }, { jar })).result).toMatchObject({
			data: { needsName: true, error: null, nameError: NAME_ERROR }
		});
		expect(
			(await run(actions.code, { code, displayName: 'New Organiser' }, { jar })).thrown
		).toMatchObject({ status: 303, location: '/new' });
	});

	it('takes the code from an earlier email after this browser asked for another', async () => {
		await findOrCreateUser(env.DB, 'sam@example.com', 'Sam');
		const first = await requested('sam@example.com');
		const { jar } = await requested('sam@example.com', first.jar);

		const { thrown } = await run(emailSignInActions(env, true).code, { code: first.code }, { jar });

		expect(thrown).toMatchObject({ status: 303, location: '/new' });
	});

	it('asks for a new email once too many wrong codes were tried', async () => {
		const { jar, code } = await requested('sam@example.com');
		const wrong = code === '000000' ? '111111' : '000000';
		const actions = emailSignInActions(env, true);

		expect((await run(actions.code, { code: wrong }, { jar })).result).toMatchObject({
			data: { needsNewEmail: false }
		});
		for (let i = 1; i < MAX_CODE_ATTEMPTS - 1; i++)
			await run(actions.code, { code: wrong }, { jar });

		expect((await run(actions.code, { code: wrong }, { jar })).result).toMatchObject({
			status: 400,
			data: { needsNewEmail: true, error: expect.stringContaining('Too many wrong codes') }
		});
	});

	it('refuses a code without the request cookie', async () => {
		const { code } = await requested('sam@example.com');

		const { result } = await run(emailSignInActions(env, true).code, { code });

		expect(result).toMatchObject({ status: 400, data: { error: expect.any(String) } });
		expect(mocks.signIn).not.toHaveBeenCalled();
	});
});

describe('linkSignInAction', () => {
	it('signs in with the token from the link', async () => {
		await findOrCreateUser(env.DB, 'sam@example.com', 'Sam');
		const { link } = await requested('sam@example.com');
		const token = new URL(link).searchParams.get('token') ?? '';

		const { thrown } = await run(linkSignInAction(env), { token });

		expect(thrown).toMatchObject({ status: 303, location: '/new' });
		expect(mocks.signIn).toHaveBeenCalledOnce();
	});

	it('asks a new address for its name', async () => {
		const { link } = await requested('new@example.com');
		const token = new URL(link).searchParams.get('token') ?? '';

		const { result } = await run(linkSignInAction(env), { token, displayName: '' });

		expect(result).toMatchObject({ status: 400, data: { error: null, nameError: NAME_ERROR } });
	});
});

describe('pendingEmail', () => {
	it('is the address this browser is waiting on, or null', async () => {
		const { jar } = await requested('sam@example.com');

		expect(await pendingEmail(env, memoryCookies(Object.fromEntries(jar)).cookies)).toBe(
			'sam@example.com'
		);
		expect(await pendingEmail(env, memoryCookies().cookies)).toBeNull();
	});
});
