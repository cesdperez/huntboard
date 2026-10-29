import { beforeEach, describe, expect, it } from 'vitest';
import { findOrCreateUser, findUserByEmail } from './users.js';
import { createTestDb } from './testing/test-db.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('findOrCreateUser', () => {
	it('creates a user for a new email', async () => {
		const user = await findOrCreateUser(db, 'sam@example.com', 'Sam');

		expect(user).toMatchObject({ email: 'sam@example.com', display_name: 'Sam' });
		expect(await findUserByEmail(db, 'sam@example.com')).toEqual(user);
	});

	it('returns the existing user and keeps its name', async () => {
		const first = await findOrCreateUser(db, 'sam@example.com', 'Sam');

		expect(await findOrCreateUser(db, 'sam@example.com', 'Someone else')).toEqual(first);
	});
});

describe('findUserByEmail', () => {
	it('is null for an email with no account', async () => {
		expect(await findUserByEmail(db, 'nobody@example.com')).toBeNull();
	});
});
