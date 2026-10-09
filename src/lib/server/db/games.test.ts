import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameByAdminToken } from './games.js';
import { createTestDb } from './testing/test-db.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('createGame', () => {
	it('stores the name with distinct link tokens and no schedule', async () => {
		const game = await createGame(db, 'Canal hunt');

		expect(game).toMatchObject({
			name: 'Canal hunt',
			starts_at: null,
			ends_at: null,
			late_penalty_per_minute: 0
		});
		expect(game.admin_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(game.scoreboard_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(game.admin_token).not.toBe(game.scoreboard_token);
	});
});

describe('getGameByAdminToken', () => {
	it('finds the game its admin token belongs to', async () => {
		const created = await createGame(db, 'Canal hunt');
		await createGame(db, 'Other hunt');

		expect(await getGameByAdminToken(db, created.admin_token)).toEqual(created);
	});

	it('returns null for an unknown token', async () => {
		await createGame(db, 'Canal hunt');

		expect(await getGameByAdminToken(db, 'nope')).toBeNull();
	});

	it('does not accept the scoreboard token as an admin token', async () => {
		const created = await createGame(db, 'Canal hunt');

		expect(await getGameByAdminToken(db, created.scoreboard_token)).toBeNull();
	});
});
