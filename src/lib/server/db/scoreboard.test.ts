import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, updateGameSettings } from './games.js';
import { getScoreboardInput } from './scoreboard.js';
import { createTestDb } from './testing/test-db.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 2,
		theme: 'flag'
	});
});

describe('getScoreboardInput', () => {
	it('takes the end time and penalty from the game', async () => {
		const input = await getScoreboardInput(db, game);

		expect(input.game).toEqual({ endsAt: '2026-06-01T21:00:00.000Z', latePenaltyPerMinute: 2 });
	});

	it('lists the teams of this game with position and arrival', async () => {
		await seedTeam(db, game.id, {
			name: 'Canal Rats',
			position: 1,
			arrived_at: '2026-06-01T21:03:00.000Z'
		});
		const owls = await seedTeam(db, game.id, {
			name: 'Night Owls',
			members: 'Ana, Bo',
			position: 0
		});
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id, { name: 'Elsewhere' });

		const { teams } = await getScoreboardInput(db, game);

		expect(teams).toEqual([
			{
				id: owls.id,
				name: 'Night Owls',
				members: 'Ana, Bo',
				avatarKey: null,
				position: 0,
				arrivedAt: null
			},
			expect.objectContaining({ name: 'Canal Rats', arrivedAt: '2026-06-01T21:03:00.000Z' })
		]);
	});

	it('includes only scored claims of this game, without notes or challenges', async () => {
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id);
		const cake = await seedChallenge(db, game.id);
		const dessert = await seedChallenge(db, game.id);
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 8, note: 'secret' });
		await seedClaim(db, rats.id, cake.id, { status: 'pending' });
		await seedClaim(db, rats.id, dessert.id, { status: 'rejected' });
		const other = await createGame(db, 'Other hunt');
		const outsider = await seedTeam(db, other.id);
		await seedClaim(db, outsider.id, (await seedChallenge(db, other.id)).id, {
			status: 'scored',
			points: 99
		});

		const { claims } = await getScoreboardInput(db, game);

		expect(claims).toEqual([{ teamId: rats.id, status: 'scored', points: 8 }]);
	});

	it('includes the adjustments of this game teams', async () => {
		const rats = await seedTeam(db, game.id);
		await seedAdjustment(db, rats.id, { points: -3 });
		const other = await createGame(db, 'Other hunt');
		await seedAdjustment(db, (await seedTeam(db, other.id)).id, { points: 50 });

		const { adjustments } = await getScoreboardInput(db, game);

		expect(adjustments).toEqual([{ teamId: rats.id, points: -3 }]);
	});
});
