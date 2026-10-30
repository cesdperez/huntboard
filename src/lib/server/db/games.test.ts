import { beforeEach, describe, expect, it } from 'vitest';
import {
	claimGame,
	createGame,
	getGameByAdminToken,
	getGameById,
	listGamesByOwner,
	resetGame,
	updateGameSettings
} from './games.js';
import { setGameImage } from './images.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import { createTestDb } from './testing/test-db.js';
import { findOrCreateUser } from './users.js';

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
			late_penalty_per_minute: 0,
			theme: 'contour'
		});
		expect(game.admin_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(game.scoreboard_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(game.admin_token).not.toBe(game.scoreboard_token);
	});
});

describe('game owners', () => {
	async function user(name: string) {
		return (await findOrCreateUser(db, `${name.toLowerCase()}@example.com`, name)).id;
	}

	it('stores the owner and lists only their games, newest first', async () => {
		const sam = await user('Sam');
		const alex = await user('Alex');
		const first = await createGame(db, 'Canal hunt', sam);
		await createGame(db, 'Other hunt', alex);
		await db
			.prepare("UPDATE game SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?")
			.bind(first.id)
			.run();
		await createGame(db, 'Bike hunt', sam);

		expect(first.owner_user_id).toBe(sam);
		expect((await listGamesByOwner(db, sam)).map((game) => game.name)).toEqual([
			'Bike hunt',
			'Canal hunt'
		]);
	});

	it('claims a game without an owner only once', async () => {
		const sam = await user('Sam');
		const alex = await user('Alex');
		const game = await createGame(db, 'Canal hunt');

		expect(await claimGame(db, game.id, sam)).toBe(true);
		expect(await claimGame(db, game.id, alex)).toBe(false);
		expect(await getGameById(db, game.id)).toMatchObject({ owner_user_id: sam });
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
		late_penalty_per_minute: 5,
		theme: 'night'
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

describe('resetGame', () => {
	const count = async (table: string) =>
		(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

	async function seedPlayedGame(name: string) {
		const created = await createGame(db, name);
		const game = await updateGameSettings(db, created.id, {
			name,
			starts_at: '2026-06-01T10:00:00.000Z',
			ends_at: '2026-06-01T15:00:00.000Z',
			late_penalty_per_minute: 2,
			theme: 'night'
		});
		const team = await seedTeam(db, game.id, { arrived_at: '2026-06-01T15:05:00.000Z' });
		const challenge = await seedChallenge(db, game.id);
		await seedClaim(db, team.id, challenge.id, { status: 'scored', points: 8 });
		await seedAdjustment(db, team.id);
		return game;
	}

	it('keeps the theme, like the name', async () => {
		const game = await seedPlayedGame('Canal hunt');

		expect(await resetGame(db, game.id)).toMatchObject({ name: 'Canal hunt', theme: 'night' });
	});

	it('removes teams, challenges, claims and adjustments and clears the schedule and image', async () => {
		const game = await seedPlayedGame('Canal hunt');
		await setGameImage(db, game.id, `${game.id}/poster.webp`, 'Invitation');

		const reset = await resetGame(db, game.id);

		expect(reset).toEqual({
			...game,
			starts_at: null,
			ends_at: null,
			late_penalty_per_minute: 0,
			image_key: null,
			image_label: ''
		});
		for (const table of ['team', 'challenge', 'claim', 'adjustment']) {
			expect(await count(table)).toBe(0);
		}
	});

	it('leaves other games alone', async () => {
		const game = await seedPlayedGame('Canal hunt');
		const other = await seedPlayedGame('Other hunt');

		await resetGame(db, game.id);

		expect(await getGameById(db, other.id)).toMatchObject({ late_penalty_per_minute: 2 });
		for (const table of ['team', 'challenge', 'claim', 'adjustment']) {
			expect(await count(table)).toBe(1);
		}
	});
});
