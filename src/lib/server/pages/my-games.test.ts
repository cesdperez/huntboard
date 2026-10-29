import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { addIdentity, createUserWithIdentity } from '../db/users.js';
import { getMyGames } from './my-games.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('getMyGames', () => {
	it("lists the user's games and sign-in methods, without passkey keys", async () => {
		const sam = await createUserWithIdentity(db, 'Sam', {
			provider: 'google',
			subject: 'sub-1',
			label: 'sam@example.com'
		});
		await addIdentity(db, sam.id, {
			provider: 'passkey',
			subject: 'credential-1',
			public_key: 'secret-ish',
			sign_count: 0
		});
		const game = await createGame(db, 'Canal hunt', sam.id);
		await createGame(db, 'Not mine');

		const page = await getMyGames(db, sam);

		expect(page).toEqual({
			displayName: 'Sam',
			games: [
				{
					name: 'Canal hunt',
					adminToken: game.admin_token,
					startsAt: null,
					createdAt: game.created_at
				}
			],
			methods: [
				{ provider: 'google', label: 'sam@example.com', createdAt: expect.any(String) },
				{ provider: 'passkey', label: '', createdAt: expect.any(String) }
			]
		});
		expect(JSON.stringify(page)).not.toContain('secret-ish');
		expect(JSON.stringify(page)).not.toContain('credential-1');
	});
});
