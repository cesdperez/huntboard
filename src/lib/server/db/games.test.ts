import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameByAdminToken, getGameById, updateGameSettings } from './games.js';
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

describe('getGameById', () => {
	it('finds a game by its id', async () => {
		const created = await createGame(db, 'Canal hunt');

		expect(await getGameById(db, created.id)).toEqual(created);
	});

	it('returns null for an unknown id', async () => {
		expect(await getGameById(db, 9999)).toBeNull();
	});
});

describe('updateGameSettings', () => {
	const settings = {
		name: 'Canal hunt at night',
		starts_at: '2026-06-20T14:00:00.000Z',
		ends_at: '2026-06-20T19:00:00.000Z',
		late_penalty_per_minute: 5
	};

	it('stores the settings and returns the updated game', async () => {
		const game = await createGame(db, 'Canal hunt');

		const updated = await updateGameSettings(db, game.id, settings);

		expect(updated).toEqual({ ...game, ...settings });
		expect(await getGameByAdminToken(db, game.admin_token)).toEqual(updated);
	});

	it('clears the times', async () => {
		const game = await createGame(db, 'Canal hunt');
		await updateGameSettings(db, game.id, settings);

		const updated = await updateGameSettings(db, game.id, {
			...settings,
			starts_at: null,
			ends_at: null
		});

		expect(updated).toMatchObject({ starts_at: null, ends_at: null });
	});

	it('leaves other games alone', async () => {
		const game = await createGame(db, 'Canal hunt');
		const other = await createGame(db, 'Other hunt');

		await updateGameSettings(db, game.id, settings);

		expect(await getGameByAdminToken(db, other.admin_token)).toEqual(other);
	});
});
