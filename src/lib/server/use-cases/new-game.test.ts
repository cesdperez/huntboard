import { beforeEach, describe, expect, it } from 'vitest';
import { getGameByAdminToken } from '../db/games.js';
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
		for (let i = 0; i < GAMES_PER_DAY; i++)
			await createNewGame(db, userId, form({ name: `Hunt ${i}` }));

		const refused = await createNewGame(db, userId, form({ name: 'One more' }));
		expect(refused).toMatchObject({ status: 429, result: { name: 'One more' } });
		expect(await gameCount()).toBe(GAMES_PER_DAY);

		await db.prepare("UPDATE game SET created_at = '2000-01-01T00:00:00.000Z'").run();
		expect(await createNewGame(db, userId, form({ name: 'Next day' }))).toEqual({
			adminToken: expect.any(String)
		});
	});
});
