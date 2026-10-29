import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { createUserWithIdentity, listIdentities } from '../db/users.js';
import { applySignIn, TAKEN_MESSAGE } from './sign-in.js';

const NO_ACCOUNT = 'No account yet.';
const google = { provider: 'google', subject: 'sub-1', label: 'sam@example.com' } as const;

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

async function userCount() {
	return db.prepare('SELECT count(*) AS n FROM user').first<number>('n');
}

describe('applySignIn', () => {
	it('signs in the owner of a known identity', async () => {
		const sam = await createUserWithIdentity(db, 'Sam', google);

		expect(await applySignIn(db, google, { kind: 'sign-in' }, NO_ACCOUNT)).toEqual({
			kind: 'signed-in',
			userId: sam.id
		});
	});

	it('refuses to sign in an unknown identity and creates nothing', async () => {
		expect(await applySignIn(db, google, { kind: 'sign-in' }, NO_ACCOUNT)).toEqual({
			kind: 'error',
			message: NO_ACCOUNT
		});
		expect(await userCount()).toBe(0);
	});

	it('creates an account with the display name on sign-up', async () => {
		const outcome = await applySignIn(
			db,
			google,
			{ kind: 'sign-up', displayName: 'Sam' },
			NO_ACCOUNT
		);

		expect(outcome).toMatchObject({ kind: 'signed-in' });
		const user = await db.prepare('SELECT * FROM user').first();
		expect(user).toMatchObject({ display_name: 'Sam' });
	});

	it('signs up a known identity into its existing account instead of a second one', async () => {
		const sam = await createUserWithIdentity(db, 'Sam', google);

		expect(
			await applySignIn(db, google, { kind: 'sign-up', displayName: 'Other' }, NO_ACCOUNT)
		).toEqual({ kind: 'signed-in', userId: sam.id });
		expect(await userCount()).toBe(1);
	});

	it('never joins accounts by email', async () => {
		await createUserWithIdentity(db, 'Sam', google);
		const sameEmail = { provider: 'google', subject: 'sub-2', label: 'sam@example.com' } as const;

		await applySignIn(db, sameEmail, { kind: 'sign-up', displayName: 'Sam 2' }, NO_ACCOUNT);

		expect(await userCount()).toBe(2);
	});

	it('adds a new identity to the signed-in account', async () => {
		const sam = await createUserWithIdentity(db, 'Sam', { provider: 'test', subject: 'sam' });

		expect(await applySignIn(db, google, { kind: 'link', userId: sam.id }, NO_ACCOUNT)).toEqual({
			kind: 'linked'
		});
		expect((await listIdentities(db, sam.id)).map((identity) => identity.provider)).toEqual([
			'test',
			'google'
		]);
	});

	it('treats linking an identity the account already has as done', async () => {
		const sam = await createUserWithIdentity(db, 'Sam', google);

		expect(await applySignIn(db, google, { kind: 'link', userId: sam.id }, NO_ACCOUNT)).toEqual({
			kind: 'linked'
		});
	});

	it('refuses to link an identity another account has', async () => {
		await createUserWithIdentity(db, 'Alex', google);
		const sam = await createUserWithIdentity(db, 'Sam', { provider: 'test', subject: 'sam' });

		expect(await applySignIn(db, google, { kind: 'link', userId: sam.id }, NO_ACCOUNT)).toEqual({
			kind: 'error',
			message: TAKEN_MESSAGE
		});
	});
});
