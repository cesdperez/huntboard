import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, updateGameSettings } from './db/games.js';
import { createTestDb } from './db/testing/test-db.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from './db/testing/seed.js';
import type { GameRow, TeamRow } from './db/types.js';
import { getCachedScoreboardPage, getScoreboardPage } from './scoreboard-page.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 2,
		theme: 'flag'
	});
	rats = await seedTeam(db, game.id, {
		name: 'Canal Rats',
		arrived_at: '2026-06-01T21:03:00.000Z'
	});
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
});

describe('getScoreboardPage', () => {
	it('shows the game name and window', async () => {
		const page = await getScoreboardPage(db, game);

		expect(page.game).toEqual({
			name: 'Canal hunt',
			startsAt: '2026-06-01T16:00:00.000Z',
			endsAt: '2026-06-01T21:00:00.000Z'
		});
	});

	it('ranks teams by total after the late penalty, ties sharing a rank, no row marked own', async () => {
		const swim = await seedChallenge(db, game.id);
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 10 });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 4 });

		const page = await getScoreboardPage(db, game);

		expect(page.standings).toEqual([
			{ teamId: rats.id, rank: 1, name: 'Canal Rats', members: '', total: 4, own: false },
			{ teamId: owls.id, rank: 1, name: 'Night Owls', members: '', total: 4, own: false }
		]);
	});

	it('never sends challenges, claims, adjustments or tokens', async () => {
		const swim = await seedChallenge(db, game.id, { title: 'Secret swim' });
		await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 10,
			note: 'rat note',
			marked_by: 'Sam',
			judged_by: 'Judge Jo'
		});
		await seedAdjustment(db, owls.id, { points: 3, reason: 'Best costume' });

		const json = JSON.stringify(await getScoreboardPage(db, game));

		for (const leak of [
			'Secret swim',
			'rat note',
			'Sam',
			'Judge Jo',
			'Best costume',
			rats.token,
			owls.token,
			game.admin_token,
			game.scoreboard_token
		]) {
			expect(json).not.toContain(leak);
		}
	});
});

describe('getCachedScoreboardPage', () => {
	function memoryCache() {
		const entries = new Map<string, Response>();
		return {
			entries,
			match: async (key: string) => entries.get(key)?.clone(),
			put: async (key: string, response: Response) => {
				entries.set(key, response);
			}
		};
	}

	it('serves repeat loads of one game from the cache until it expires', async () => {
		const cache = memoryCache();
		const first = await getCachedScoreboardPage(db, game, 'https://huntboard.example', cache);
		await seedClaim(db, owls.id, (await seedChallenge(db, game.id)).id, {
			status: 'scored',
			points: 50
		});
		expect(await getCachedScoreboardPage(db, game, 'https://huntboard.example', cache)).toEqual(
			first
		);
		const [key, stored] = [...cache.entries][0];
		expect(key).toBe(`https://huntboard.example/__cache/scoreboard/${game.id}`);
		expect(stored.headers.get('Cache-Control')).toBe('max-age=15');
	});

	it('reads the database when no cache is available', async () => {
		expect(await getCachedScoreboardPage(db, game, 'https://huntboard.example', undefined)).toEqual(
			await getScoreboardPage(db, game)
		);
	});
});
