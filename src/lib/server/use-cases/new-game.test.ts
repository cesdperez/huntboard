import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameByAdminToken } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser } from '../db/users.js';
import { createNewGame, GAMES_PER_DAY } from './new-game.js';

let db: D1Database;
let userId: number;

beforeEach(async () => {
	db = createTestDb();
	userId = (await findOrCreateUser(db, 'sam@example.com', 'Sam')).id;
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

async function gameCount() {
	return db.prepare('SELECT count(*) AS n FROM game').first<number>('n');
}

describe('createNewGame', () => {
	it('creates the game owned by the user and returns its admin token', async () => {
		const outcome = await createNewGame(db, userId, form({ name: ' Canal hunt ' }));

		expect(outcome).toEqual({ adminToken: expect.any(String) });
		const adminToken = (outcome as { adminToken: string }).adminToken;
		expect(await getGameByAdminToken(db, adminToken)).toMatchObject({
			name: 'Canal hunt',
			owner_user_id: userId
		});
	});

	it('refuses an empty name', async () => {
		const outcome = await createNewGame(db, userId, form({ name: '  ' }));

		expect(outcome).toEqual({ status: 400, result: { name: '', error: 'Give the game a name.' } });
		expect(await gameCount()).toBe(0);
	});

	it('refuses a game past the daily limit, and counts only the last day', async () => {
		expect(GAMES_PER_DAY).toBe(5);
		for (let i = 0; i < GAMES_PER_DAY; i++)
			await createNewGame(db, userId, form({ name: `Hunt ${i}` }));

		const refused = await createNewGame(db, userId, form({ name: 'One more' }));
		expect(refused).toEqual({
			status: 429,
			result: {
				name: 'One more',
				error: `You can create ${GAMES_PER_DAY} games in 24 hours. Try again later.`
			}
		});
		expect(await gameCount()).toBe(GAMES_PER_DAY);

		await db.prepare("UPDATE game SET created_at = '2000-01-01T00:00:00.000Z'").run();
		expect(await createNewGame(db, userId, form({ name: 'Next day' }))).toEqual({
			adminToken: expect.any(String)
		});
	});

	it('limits games in 30 days but excludes older games and other owners', async () => {
		const other = (await findOrCreateUser(db, 'other@example.com', 'Other')).id;
		for (let i = 0; i < 20; i++) {
			const game = await createGame(db, `Old ${i}`, userId);
			await db
				.prepare(
					"UPDATE game SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days') WHERE id = ?"
				)
				.bind(game.id)
				.run();
		}
		await createGame(db, 'Other', other);
		expect(await createNewGame(db, userId, form({ name: 'Refused' }))).toEqual({
			status: 429,
			result: { name: 'Refused', error: 'You can create 20 games in 30 days. Try again later.' }
		});
		await db
			.prepare(
				"UPDATE game SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-31 days') WHERE id = (SELECT min(id) FROM game WHERE owner_user_id = ?)"
			)
			.bind(userId)
			.run();
		expect(await createNewGame(db, userId, form({ name: 'Allowed' }))).toEqual({
			adminToken: expect.any(String)
		});
	});

	it('holds the daily limit when many requests arrive at once', async () => {
		const outcomes = await Promise.all(
			Array.from({ length: GAMES_PER_DAY + 5 }, (_, i) =>
				createNewGame(db, userId, form({ name: `Hunt ${i}` }))
			)
		);

		expect(await gameCount()).toBe(GAMES_PER_DAY);
		expect(outcomes.filter((outcome) => 'status' in outcome)).toHaveLength(5);
	});
});
