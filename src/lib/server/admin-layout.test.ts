import { beforeEach, describe, expect, it } from 'vitest';
import { getAdminLayout } from './admin-layout.js';
import { createGame, updateGameSettings } from './db/games.js';
import { createTestDb } from './db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './db/testing/seed.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('getAdminLayout', () => {
	it("themes the admin pages with the game's theme and counts the claims to judge", async () => {
		const game = await createGame(db, 'Canal hunt');
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		await seedClaim(db, rats.id, (await seedChallenge(db, game.id, { title: 'Swim' })).id);
		const locals: App.Locals = {};

		const layout = await getAdminLayout(db, game, locals);

		expect(layout).toEqual({ game, pendingCount: 1, gameTheme: 'highland-bru' });
		expect(locals.gameTheme).toBe('highland-bru');
	});

	it('keeps a flag game in flag', async () => {
		const game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
			name: 'Canal hunt',
			starts_at: null,
			ends_at: null,
			late_penalty_per_minute: 0,
			theme: 'flag'
		});
		const locals: App.Locals = {};

		expect((await getAdminLayout(db, game, locals)).gameTheme).toBe('flag');
		expect(locals.gameTheme).toBe('flag');
	});
});
