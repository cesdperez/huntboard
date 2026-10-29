import { beforeEach, describe, expect, it } from 'vitest';
import { deleteSession, extendSession, getSessionWithUser, insertSession } from './sessions.js';
import { createTestDb } from './testing/test-db.js';
import { createUserWithIdentity } from './users.js';

let db: D1Database;
let userId: number;

beforeEach(async () => {
	db = createTestDb();
	userId = (await createUserWithIdentity(db, 'Sam', { provider: 'test', subject: 'sam' })).id;
});

describe('sessions', () => {
	it('reads a session back with its user', async () => {
		await insertSession(db, {
			id: 'hash-1',
			user_id: userId,
			expires_at: '2030-01-01T00:00:00.000Z'
		});

		expect(await getSessionWithUser(db, 'hash-1')).toEqual({
			session: { id: 'hash-1', user_id: userId, expires_at: '2030-01-01T00:00:00.000Z' },
			user: expect.objectContaining({ id: userId, display_name: 'Sam' })
		});
	});

	it('finds nothing for an unknown id', async () => {
		expect(await getSessionWithUser(db, 'missing')).toBeNull();
	});

	it('moves the expiry and deletes', async () => {
		await insertSession(db, {
			id: 'hash-1',
			user_id: userId,
			expires_at: '2030-01-01T00:00:00.000Z'
		});

		await extendSession(db, 'hash-1', '2031-01-01T00:00:00.000Z');
		expect((await getSessionWithUser(db, 'hash-1'))?.session.expires_at).toBe(
			'2031-01-01T00:00:00.000Z'
		);

		await deleteSession(db, 'hash-1');
		expect(await getSessionWithUser(db, 'hash-1')).toBeNull();
	});

	it('goes when its user is deleted', async () => {
		await insertSession(db, {
			id: 'hash-1',
			user_id: userId,
			expires_at: '2030-01-01T00:00:00.000Z'
		});

		await db.prepare('DELETE FROM user WHERE id = ?').bind(userId).run();

		expect(await getSessionWithUser(db, 'hash-1')).toBeNull();
	});
});
