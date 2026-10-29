import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser } from '../db/users.js';
import { getMyGames } from './my-games.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('getMyGames', () => {
	it("lists only the user's games", async () => {
		const sam = await findOrCreateUser(db, 'sam@example.com', 'Sam');
		const game = await createGame(db, 'Canal hunt', sam.id);
		await createGame(db, 'Not mine');

		expect(await getMyGames(db, sam)).toEqual({
			displayName: 'Sam',
			email: 'sam@example.com',
			games: [
				{
					name: 'Canal hunt',
					adminToken: game.admin_token,
					startsAt: null,
					createdAt: game.created_at
				}
			]
		});
	});
});
