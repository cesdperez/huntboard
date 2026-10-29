import { beforeEach, describe, expect, it } from 'vitest';
import {
	addIdentity,
	createUserWithIdentity,
	findIdentity,
	listIdentities,
	updatePasskeySignCount
} from './users.js';
import { createTestDb } from './testing/test-db.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

const google = { provider: 'google', subject: 'google-sub-1', label: 'sam@example.com' } as const;
const passkey = {
	provider: 'passkey',
	subject: 'credential-1',
	public_key: 'cose-key',
	sign_count: 0,
	transports: '["internal"]'
} as const;

describe('createUserWithIdentity', () => {
	it('creates the user and its first identity together', async () => {
		const user = await createUserWithIdentity(db, 'Sam', google);

		expect(user).toMatchObject({ display_name: 'Sam' });
		expect(await findIdentity(db, 'google', 'google-sub-1')).toMatchObject({
			user_id: user.id,
			label: 'sam@example.com'
		});
	});

	it('refuses an identity another user already has, and creates no user', async () => {
		await createUserWithIdentity(db, 'Sam', google);

		await expect(createUserWithIdentity(db, 'Alex', google)).rejects.toThrow();
		expect(await db.prepare('SELECT count(*) AS n FROM user').first('n')).toBe(1);
	});
});

describe('addIdentity', () => {
	it('adds a passkey to an existing user', async () => {
		const user = await createUserWithIdentity(db, 'Sam', google);

		expect(await addIdentity(db, user.id, passkey)).toBe(true);
		expect((await listIdentities(db, user.id)).map((identity) => identity.provider)).toEqual([
			'google',
			'passkey'
		]);
	});

	it('returns false when the identity is taken', async () => {
		const sam = await createUserWithIdentity(db, 'Sam', google);
		const alex = await createUserWithIdentity(db, 'Alex', passkey);

		expect(await addIdentity(db, sam.id, { ...passkey })).toBe(false);
		expect(await findIdentity(db, 'passkey', 'credential-1')).toMatchObject({ user_id: alex.id });
	});
});

describe('findIdentity', () => {
	it('finds nothing for an unknown subject', async () => {
		expect(await findIdentity(db, 'google', 'nobody')).toBeNull();
	});

	it('keeps providers apart', async () => {
		await createUserWithIdentity(db, 'Sam', { provider: 'test', subject: 'google-sub-1' });

		expect(await findIdentity(db, 'google', 'google-sub-1')).toBeNull();
	});
});

describe('updatePasskeySignCount', () => {
	it('stores the counter the authenticator reported', async () => {
		await createUserWithIdentity(db, 'Sam', passkey);
		const identity = await findIdentity(db, 'passkey', 'credential-1');

		await updatePasskeySignCount(db, identity!.id, 7);

		expect(await findIdentity(db, 'passkey', 'credential-1')).toMatchObject({ sign_count: 7 });
	});
});
