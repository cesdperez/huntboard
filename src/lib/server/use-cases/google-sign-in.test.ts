import { OAuth2Tokens } from 'arctic';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeBase64Url } from '#lib/domain/token.js';
import { createTestDb } from '../db/testing/test-db.js';
import { findIdentity } from '../db/users.js';
import {
	finishGoogleSignIn,
	NO_GOOGLE_ACCOUNT_MESSAGE,
	startGoogleSignIn,
	type GoogleClient
} from './google-sign-in.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

function idToken(claims: Record<string, unknown>): string {
	const part = (value: object) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
	return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

function fakeGoogle(claims: Record<string, unknown> | Error): GoogleClient {
	return {
		createAuthorizationURL: (state, verifier, scopes) => {
			const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
			url.searchParams.set('state', state);
			url.searchParams.set('scope', scopes.join(' '));
			return url;
		},
		validateAuthorizationCode: vi.fn(async () => {
			if (claims instanceof Error) throw claims;
			return new OAuth2Tokens({ id_token: idToken(claims) });
		})
	};
}

const attempt = { state: 'state-1', codeVerifier: 'verifier-1' };
const callback = new URLSearchParams({ code: 'code-1', state: 'state-1' });
const signUp = { kind: 'sign-up', displayName: 'Sam' } as const;

describe('startGoogleSignIn', () => {
	it('asks only for the basic scopes and lets the user pick an account', () => {
		const { url, attempt } = startGoogleSignIn(fakeGoogle({}));

		expect(url.searchParams.get('scope')).toBe('openid email profile');
		expect(url.searchParams.get('state')).toBe(attempt.state);
		expect(url.searchParams.get('prompt')).toBe('select_account');
		expect(attempt.codeVerifier).not.toBe('');
	});
});

describe('finishGoogleSignIn', () => {
	it('signs up with the Google sub and keeps the email as a label', async () => {
		const google = fakeGoogle({ sub: 'sub-1', email: 'sam@example.com' });

		const outcome = await finishGoogleSignIn(db, google, callback, attempt, signUp);

		expect(outcome).toMatchObject({ kind: 'signed-in' });
		expect(google.validateAuthorizationCode).toHaveBeenCalledWith('code-1', 'verifier-1');
		expect(await findIdentity(db, 'google', 'sub-1')).toMatchObject({ label: 'sam@example.com' });
	});

	it('tells an unknown Google account to create an account first', async () => {
		const google = fakeGoogle({ sub: 'sub-1', email: 'sam@example.com' });

		expect(await finishGoogleSignIn(db, google, callback, attempt, { kind: 'sign-in' })).toEqual({
			kind: 'error',
			message: NO_GOOGLE_ACCOUNT_MESSAGE
		});
	});

	it.each([
		[
			'a state that does not match',
			new URLSearchParams({ code: 'code-1', state: 'other' }),
			attempt
		],
		['no code', new URLSearchParams({ state: 'state-1' }), attempt],
		['no attempt cookie', callback, null]
	])('refuses %s without asking Google', async (_, params, stored) => {
		const google = fakeGoogle({ sub: 'sub-1' });

		expect(await finishGoogleSignIn(db, google, params, stored, signUp)).toMatchObject({
			kind: 'error'
		});
		expect(google.validateAuthorizationCode).not.toHaveBeenCalled();
	});

	it('fails when Google refuses the code', async () => {
		const google = fakeGoogle(new Error('invalid_grant'));

		expect(await finishGoogleSignIn(db, google, callback, attempt, signUp)).toMatchObject({
			kind: 'error'
		});
	});

	it('fails on an ID token without a subject', async () => {
		const google = fakeGoogle({ email: 'sam@example.com' });

		expect(await finishGoogleSignIn(db, google, callback, attempt, signUp)).toMatchObject({
			kind: 'error'
		});
	});
});
