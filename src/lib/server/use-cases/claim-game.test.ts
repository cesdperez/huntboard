import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameById } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser } from '../db/users.js';
import { claimGame } from './claim-game.js';

let db: D1Database;
let sam: number;
let alex: number;

beforeEach(async () => {
	db = createTestDb();
	sam = (await findOrCreateUser(db, 'sam@example.com', 'Sam')).id;
	alex = (await findOrCreateUser(db, 'alex@example.com', 'Alex')).id;
});

describe('claimGame', () => {
	it('makes the user the owner of a game without one', async () => {
		const game = await createGame(db, 'Canal hunt');

		expect(await claimGame(db, game, sam)).toEqual({ status: 200, result: { kind: 'claimed' } });
		expect(await getGameById(db, game.id)).toMatchObject({ owner_user_id: sam });
	});

	it('accepts a second claim by the owner', async () => {
		const game = await createGame(db, 'Canal hunt', sam);

		expect(await claimGame(db, game, sam)).toEqual({ status: 200, result: { kind: 'claimed' } });
	});

	it('refuses a game someone else owns', async () => {
		const game = await createGame(db, 'Canal hunt', alex);

		expect(await claimGame(db, game, sam)).toMatchObject({ status: 409 });
		expect(await getGameById(db, game.id)).toMatchObject({ owner_user_id: alex });
	});

	it('refuses when another claim landed after the game was read', async () => {
		const game = await createGame(db, 'Canal hunt');
		await claimGame(db, game, alex);

		expect(await claimGame(db, game, sam)).toMatchObject({ status: 409 });
		expect(await getGameById(db, game.id)).toMatchObject({ owner_user_id: alex });
	});
});
