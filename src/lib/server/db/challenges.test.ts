import { beforeEach, describe, expect, it } from 'vitest';
import { listChallengesWithClaimCounts } from './challenges.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
});

describe('listChallengesWithClaimCounts', () => {
	it('lists only this game challenges in position order', async () => {
		await seedChallenge(db, game.id, { title: 'Second', position: 1 });
		await seedChallenge(db, game.id, { title: 'First', position: 0 });
		const other = await createGame(db, 'Other hunt');
		await seedChallenge(db, other.id, { title: 'Elsewhere' });

		const challenges = await listChallengesWithClaimCounts(db, game.id);

		expect(challenges.map((challenge) => challenge.title)).toEqual(['First', 'Second']);
	});

	it('counts every claim on a challenge across teams, rejected history included', async () => {
		const rats = await seedTeam(db, game.id);
		const owls = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		const cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
		await seedClaim(db, rats.id, swim.id, { status: 'rejected' });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 7 });

		const challenges = await listChallengesWithClaimCounts(db, game.id);

		expect(challenges).toEqual([
			{ ...swim, claim_count: 2 },
			{ ...cake, claim_count: 0 }
		]);
	});
});
