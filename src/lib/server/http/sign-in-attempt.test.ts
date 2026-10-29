import { describe, expect, it } from 'vitest';
import { parseAttempt, resolveIntent, type SignInAttempt } from './sign-in-attempt.js';

const user = { id: 7, display_name: 'Sam', created_at: '2026-01-01T00:00:00.000Z' };

function attempt(fields: Partial<SignInAttempt> = {}): SignInAttempt {
	return { intent: 'sign-in', displayName: '', next: '/games', ...fields };
}

describe('parseAttempt', () => {
	it('reads back a stored attempt', () => {
		const stored = attempt({
			intent: 'sign-up',
			displayName: 'Sam',
			next: '/new',
			google: { state: 's', codeVerifier: 'v' }
		});

		expect(parseAttempt(JSON.stringify(stored))).toEqual(stored);
	});

	it('sends an off-site next path to My games', () => {
		expect(parseAttempt(JSON.stringify(attempt({ next: '//evil.example' })))?.next).toBe('/games');
	});

	it.each([
		['not JSON', '{'],
		['an unknown intent', JSON.stringify({ ...attempt(), intent: 'admin' })],
		['a broken Google attempt', JSON.stringify({ ...attempt(), google: { state: 1 } })],
		['a non-string challenge', JSON.stringify({ ...attempt(), challenge: 5 })],
		['null', 'null']
	])('refuses %s', (_, value) => {
		expect(parseAttempt(value)).toBeNull();
	});
});

describe('resolveIntent', () => {
	it('signs up with the normalized display name', () => {
		expect(resolveIntent(attempt({ intent: 'sign-up', displayName: '  Sam  ' }), null)).toEqual({
			kind: 'sign-up',
			displayName: 'Sam'
		});
	});

	it('refuses a sign-up without a display name', () => {
		expect(resolveIntent(attempt({ intent: 'sign-up', displayName: ' ' }), null)).toBeNull();
	});

	it('links to the user signed in now, not one named in the cookie', () => {
		expect(resolveIntent(attempt({ intent: 'link' }), user)).toEqual({ kind: 'link', userId: 7 });
		expect(resolveIntent(attempt({ intent: 'link' }), null)).toBeNull();
	});
});
