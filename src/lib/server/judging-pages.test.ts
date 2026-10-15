import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, updateGameSettings } from './db/games.js';
import { createTestDb } from './db/testing/test-db.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from './db/testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from './db/types.js';
import { getGridPage, getTeamScoresPage } from './judging-pages.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;
let swim: ChallengeRow;
let cake: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 2
	});
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
	swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
	cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
});

describe('getGridPage', () => {
	it('lists the teams as columns and every claim of the game in its cell', async () => {
		await seedClaim(db, rats.id, cake.id, { status: 'scored', points: 7 });
		await seedClaim(db, owls.id, swim.id);

		const page = await getGridPage(db, game.id);

		expect(page.teams).toEqual([
			{ id: rats.id, name: 'Canal Rats' },
			{ id: owls.id, name: 'Night Owls' }
		]);
		expect(
			page.rows.map((row) => [row.title, row.cells.map((cell) => cell.claim?.status ?? 'open')])
		).toEqual([
			['Swim in a fountain', ['open', 'pending']],
			['Bake a cake', ['scored', 'open']]
		]);
	});
});

describe('getTeamScoresPage', () => {
	it('breaks down each team total, in team order, with rank and adjustments', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 10 });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 8 });
		await seedClaim(db, owls.id, cake.id, { status: 'pending' });
		const bonus = await seedAdjustment(db, owls.id, {
			points: 5,
			reason: 'Best costume',
			created_by: 'Alex'
		});
		await db
			.prepare('UPDATE team SET arrived_at = ? WHERE id = ?')
			.bind('2026-06-01T21:03:30.000Z', rats.id)
			.run();

		const page = await getTeamScoresPage(db, game);

		expect(page.game).toEqual({ endsAt: '2026-06-01T21:00:00.000Z', latePenaltyPerMinute: 2 });
		expect(page.teams).toEqual([
			{
				id: rats.id,
				name: 'Canal Rats',
				members: '',
				arrivedAt: '2026-06-01T21:03:30.000Z',
				rank: 2,
				claimPoints: 10,
				adjustmentPoints: 0,
				minutesLate: 3,
				latePenalty: 6,
				total: 4,
				adjustments: []
			},
			{
				id: owls.id,
				name: 'Night Owls',
				members: '',
				arrivedAt: null,
				rank: 1,
				claimPoints: 8,
				adjustmentPoints: 5,
				minutesLate: 0,
				latePenalty: 0,
				total: 13,
				adjustments: [
					{
						id: bonus.id,
						points: 5,
						reason: 'Best costume',
						createdBy: 'Alex',
						createdAt: bonus.created_at
					}
				]
			}
		]);
	});
});
