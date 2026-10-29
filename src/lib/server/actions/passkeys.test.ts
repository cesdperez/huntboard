import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { memoryCookies } from '../testing/memory-cookies.js';

const mocks = vi.hoisted(() => ({
	env: { DB: null as unknown as D1Database },
	getSignedInUser: vi.fn(),
	signIn: vi.fn()
}));

vi.mock('../http/session.js', () => ({
	getSignedInUser: mocks.getSignedInUser,
	signIn: mocks.signIn
}));

import { passkeyOptions as options, passkeyVerify as verify } from './passkeys.js';

const passkeyOptions = options(mocks.env as Cloudflare.Env);
const passkeyVerify = verify(mocks.env as Cloudflare.Env);

const sam = { id: 7, display_name: 'Sam', created_at: '2026-01-01T00:00:00.000Z' };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.env.DB = createTestDb();
	mocks.getSignedInUser.mockResolvedValue(null);
});

async function call(
	handler: typeof passkeyOptions,
	body: unknown,
	jar: Record<string, string> = {}
) {
	const { cookies, jar: stored } = memoryCookies(jar);
	const request = new Request('https://huntboard.example/login/passkey/options', {
		method: 'POST',
		body: JSON.stringify(body)
	});
	const url = new URL(request.url);
	const response = await handler({ request, cookies, url } as Parameters<typeof handler>[0]);
	const attempt = stored.get('sign_in_attempt');
	return {
		status: response.status,
		body: (await response.json()) as {
			options: { challenge: string; user: { name: string } };
			error?: string;
		},
		attempt: attempt ? JSON.parse(attempt) : undefined
	};
}

describe('passkeyOptions', () => {
	it('starts a sign-in and keeps the checked next path with the challenge', async () => {
		const { status, body, attempt } = await call(passkeyOptions, {
			intent: 'sign-in',
			next: '//evil.example'
		});

		expect(status).toBe(200);
		expect(attempt).toEqual({
			intent: 'sign-in',
			displayName: '',
			next: '/games',
			challenge: body.options.challenge
		});
	});

	it('starts a sign-up under the typed name', async () => {
		const { status, body, attempt } = await call(passkeyOptions, {
			intent: 'sign-up',
			displayName: '  Sam ',
			next: '/new'
		});

		expect(status).toBe(200);
		expect(body.options.user.name).toBe('Sam');
		expect(attempt).toMatchObject({ intent: 'sign-up', displayName: 'Sam', next: '/new' });
	});

	it('refuses a sign-up without a name and stores no attempt', async () => {
		const { status, body, attempt } = await call(passkeyOptions, {
			intent: 'sign-up',
			displayName: ' '
		});

		expect(status).toBe(400);
		expect(body).toEqual({ error: 'Type the name to show on your account.' });
		expect(attempt).toBeUndefined();
	});

	it('refuses to add a passkey without a session', async () => {
		const { status, attempt } = await call(passkeyOptions, { intent: 'link' });

		expect(status).toBe(401);
		expect(attempt).toBeUndefined();
	});

	it('adds a passkey under the account name and returns to My games', async () => {
		mocks.getSignedInUser.mockResolvedValue(sam);

		const { body, attempt } = await call(passkeyOptions, {
			intent: 'link',
			displayName: 'Ignored',
			next: '/new'
		});

		expect(body.options.user.name).toBe('Sam');
		expect(attempt).toMatchObject({ intent: 'link', next: '/games' });
	});
});

describe('passkeyVerify', () => {
	it('refuses without an attempt cookie', async () => {
		const { status, body } = await call(passkeyVerify, { response: { id: 'x' } });

		expect(status).toBe(400);
		expect(body).toEqual({ error: 'That passkey request took too long. Try again.' });
		expect(mocks.signIn).not.toHaveBeenCalled();
	});

	it('uses the attempt once', async () => {
		const attempt = JSON.stringify({
			intent: 'sign-in',
			displayName: '',
			next: '/games',
			challenge: 'challenge-1'
		});
		const { cookies, jar } = memoryCookies({ sign_in_attempt: attempt });
		const request = new Request('https://huntboard.example/login/passkey/verify', {
			method: 'POST',
			body: JSON.stringify({ response: { id: 'unknown' } })
		});

		const response = await passkeyVerify({
			request,
			cookies,
			url: new URL(request.url)
		} as Parameters<typeof passkeyVerify>[0]);

		expect(response.status).toBe(400);
		expect(jar.has('sign_in_attempt')).toBe(false);
	});
});
