import { OAuth2Tokens } from 'arctic';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeBase64Url } from '#lib/domain/token.js';
import { createTestDb } from '../db/testing/test-db.js';
import { createUserWithIdentity } from '../db/users.js';
import { memoryCookies } from '../testing/memory-cookies.js';
import type { GoogleClient } from '../use-cases/google-sign-in.js';

const mocks = vi.hoisted(() => ({
	env: { DB: null as unknown as D1Database },
	google: null as GoogleClient | null,
	getSignedInUser: vi.fn(),
	signIn: vi.fn()
}));

vi.mock('../http/google.js', () => ({ googleClient: () => mocks.google }));
vi.mock('../http/session.js', () => ({
	getSignedInUser: mocks.getSignedInUser,
	signIn: mocks.signIn
}));

import { googleAction, googleCallback } from './sign-in.js';

const callback = googleCallback(mocks.env as Cloudflare.Env);
const sam = { id: 7, display_name: 'Sam', created_at: '2026-01-01T00:00:00.000Z' };

function fakeGoogle(sub: string): GoogleClient {
	const part = (value: object) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
	return {
		createAuthorizationURL: (state) =>
			new URL(`https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
		validateAuthorizationCode: async () =>
			new OAuth2Tokens({ id_token: `${part({})}.${part({ sub, email: 'sam@example.com' })}.sig` })
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.env.DB = createTestDb();
	mocks.google = fakeGoogle('sub-1');
	mocks.getSignedInUser.mockResolvedValue(null);
});

async function start(fields: Record<string, string>, query = '') {
	const { cookies, jar } = memoryCookies();
	const request = new Request(`https://huntboard.example/login?/google${query}`, {
		method: 'POST',
		body: new URLSearchParams(fields)
	});
	const event = { request, cookies, url: new URL(request.url) };
	const outcome = await Promise.resolve(
		googleAction(event as unknown as Parameters<typeof googleAction>[0])
	).then(
		(result) => ({ result, thrown: undefined }),
		(thrown: { status: number; location: string }) => ({ result: undefined, thrown })
	);
	return { ...outcome, jar };
}

async function finish(jar: Map<string, string>, state: string | null) {
	const { cookies, jar: after } = memoryCookies(Object.fromEntries(jar));
	const url = new URL('https://huntboard.example/login/google/callback?code=code-1');
	if (state) url.searchParams.set('state', state);
	const thrown = await Promise.resolve(
		callback({ cookies, url } as unknown as Parameters<typeof callback>[0])
	).catch((error: { status: number; location: string }) => error);
	return { thrown: thrown as { status: number; location: string }, jar: after };
}

function storedState(jar: Map<string, string>): string {
	return JSON.parse(jar.get('sign_in_attempt')!).google.state;
}

describe('googleAction', () => {
	it('redirects a sign-up to Google with the attempt in a cookie', async () => {
		const { thrown, jar } = await start({ intent: 'sign-up', displayName: 'Sam' }, '&next=/new');

		expect(thrown).toMatchObject({ status: 303 });
		expect(thrown!.location).toMatch(/^https:\/\/accounts\.google\.com\//);
		expect(JSON.parse(jar.get('sign_in_attempt')!)).toMatchObject({
			intent: 'sign-up',
			displayName: 'Sam',
			next: '/new'
		});
	});

	it('refuses a sign-up without a name', async () => {
		const { result, jar } = await start({ intent: 'sign-up', displayName: ' ' });

		expect(result).toMatchObject({ status: 400 });
		expect(jar.has('sign_in_attempt')).toBe(false);
	});

	it('answers 503 when Google is not configured', async () => {
		mocks.google = null;

		expect((await start({ intent: 'sign-in' })).result).toMatchObject({ status: 503 });
	});

	it('sends an add-Google request without a session to sign in', async () => {
		const { thrown, jar } = await start({ intent: 'link' });

		expect(thrown).toMatchObject({ status: 303, location: '/login' });
		expect(jar.has('sign_in_attempt')).toBe(false);
	});
});

describe('googleCallback', () => {
	it('signs up, starts a session and goes to the next path', async () => {
		const { jar } = await start({ intent: 'sign-up', displayName: 'Sam' }, '&next=/new');

		const { thrown } = await finish(jar, storedState(jar));

		expect(thrown).toMatchObject({ status: 303, location: '/new' });
		expect(mocks.signIn).toHaveBeenCalledWith(expect.anything(), expect.any(Number));
	});

	it('shows an unknown Google account on the sign-in page', async () => {
		const { jar } = await start({ intent: 'sign-in' });

		const { thrown, jar: after } = await finish(jar, storedState(jar));

		expect(thrown).toMatchObject({ status: 303, location: '/login' });
		expect(after.get('sign_in_error')).toMatch(/Create an account first/);
		expect(mocks.signIn).not.toHaveBeenCalled();
	});

	it('shows a failed add-Google on My games, keeping the session', async () => {
		mocks.getSignedInUser.mockResolvedValue(sam);
		await createUserWithIdentity(mocks.env.DB, 'Alex', { provider: 'google', subject: 'sub-1' });
		const { jar } = await start({ intent: 'link' });

		const { thrown, jar: after } = await finish(jar, storedState(jar));

		expect(thrown).toMatchObject({ status: 303, location: '/games' });
		expect(after.get('sign_in_error')).toMatch(/another Huntboard account/);
		expect(mocks.signIn).not.toHaveBeenCalled();
	});

	it('refuses a callback without an attempt cookie', async () => {
		const { thrown, jar } = await finish(new Map(), 'state');

		expect(thrown).toMatchObject({ status: 303, location: '/login' });
		expect(jar.get('sign_in_error')).toMatch(/took too long/);
	});
});
