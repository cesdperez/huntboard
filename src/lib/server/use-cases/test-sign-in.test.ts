import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { testSignIn } from './test-sign-in.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('testSignIn', () => {
	it('creates one account per name and signs it in again', async () => {
		const first = await testSignIn(db, 'Rehearsal judge');

		expect(first).toEqual(expect.any(Number));
		expect(await testSignIn(db, 'Rehearsal judge')).toBe(first);
		expect(await testSignIn(db, 'Other judge')).not.toBe(first);
	});

	it('refuses an empty name', async () => {
		expect(await testSignIn(db, '  ')).toBeNull();
	});
});
