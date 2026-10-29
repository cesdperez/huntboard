import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { createUserWithIdentity } from '../db/users.js';
import { endSession, SESSION_DAYS, startSession, validateSession } from './sessions.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-01T12:00:00.000Z');

let db: D1Database;
let userId: number;

beforeEach(async () => {
	db = createTestDb();
	userId = (await createUserWithIdentity(db, 'Sam', { provider: 'test', subject: 'sam' })).id;
});

function daysAfter(date: Date, days: number) {
	return new Date(date.getTime() + days * DAY_MS);
}

describe('sessions', () => {
	it('opens a session for the token it returns, and stores only its hash', async () => {
		const { token, expiresAt } = await startSession(db, userId, NOW);

		expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(expiresAt).toEqual(daysAfter(NOW, SESSION_DAYS));
		expect(await validateSession(db, token, NOW)).toMatchObject({
			user: { id: userId, display_name: 'Sam' },
			renewedUntil: null
		});
		const stored = await db.prepare('SELECT id FROM session').first<string>('id');
		expect(stored).not.toBe(token);
	});

	it('opens nothing for an unknown token', async () => {
		expect(await validateSession(db, 'not-a-session', NOW)).toBeNull();
	});

	it('refuses and deletes an expired session', async () => {
		const { token } = await startSession(db, userId, NOW);
		const later = daysAfter(NOW, SESSION_DAYS);

		expect(await validateSession(db, token, later)).toBeNull();
		expect(await db.prepare('SELECT count(*) AS n FROM session').first('n')).toBe(0);
	});

	it('renews a session used in its second half', async () => {
		const { token } = await startSession(db, userId, NOW);
		const later = daysAfter(NOW, SESSION_DAYS - 10);

		const valid = await validateSession(db, token, later);

		expect(valid?.renewedUntil).toEqual(daysAfter(later, SESSION_DAYS));
		expect(await validateSession(db, token, daysAfter(NOW, SESSION_DAYS + 1))).not.toBeNull();
	});

	it('ends a session', async () => {
		const { token } = await startSession(db, userId, NOW);

		await endSession(db, token);

		expect(await validateSession(db, token, NOW)).toBeNull();
	});

	it('clears the user expired sessions when a new one starts', async () => {
		await startSession(db, userId, NOW);

		await startSession(db, userId, daysAfter(NOW, SESSION_DAYS + 1));

		expect(await db.prepare('SELECT count(*) AS n FROM session').first('n')).toBe(1);
	});
});
