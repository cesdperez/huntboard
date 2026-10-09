import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from './games.js';
import { listTeamsWithClaimCounts } from './teams.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
});

describe('listTeamsWithClaimCounts', () => {
	it('lists only this game teams in position order', async () => {
		await seedTeam(db, game.id, { name: 'Second', position: 1 });
		await seedTeam(db, game.id, { name: 'First', position: 0 });
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id, { name: 'Elsewhere' });

		const teams = await listTeamsWithClaimCounts(db, game.id);

		expect(teams.map((team) => team.name)).toEqual(['First', 'Second']);
	});

	it('counts every claim of a team, rejected history included', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		const owls = await seedTeam(db, game.id, { name: 'Night Owls' });
		const swim = await seedChallenge(db, game.id);
		const cake = await seedChallenge(db, game.id);
		await seedClaim(db, rats.id, swim.id, { status: 'rejected' });
		await seedClaim(db, rats.id, swim.id, { status: 'pending' });
		await seedClaim(db, rats.id, cake.id, { status: 'scored', points: 10 });

		const teams = await listTeamsWithClaimCounts(db, game.id);

		expect(teams).toEqual([
			{ ...rats, claim_count: 3 },
			{ ...owls, claim_count: 0 }
		]);
	});
});
