import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from './games.js';
import {
	addTeam,
	deleteTeam,
	listTeamsWithClaimCounts,
	moveTeam,
	renameTeam,
	setArrival
} from './teams.js';
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

async function names(gameId = game.id) {
	const teams = await listTeamsWithClaimCounts(db, gameId);
	return teams.map((team) => `${team.position}:${team.name}`);
}

describe('addTeam', () => {
	it('adds the team at the end with its own link token', async () => {
		await seedTeam(db, game.id, { name: 'Canal Rats' });

		const owls = await addTeam(db, game.id, 'Night Owls');

		expect(owls).toMatchObject({ game_id: game.id, name: 'Night Owls', position: 1 });
		expect(owls.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(await names()).toEqual(['0:Canal Rats', '1:Night Owls']);
	});

	it('starts at position 0 in a game without teams, whatever other games hold', async () => {
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id);

		expect((await addTeam(db, game.id, 'Canal Rats')).position).toBe(0);
	});
});

describe('renameTeam', () => {
	it('renames a team of this game', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });

		expect(await renameTeam(db, game.id, rats.id, 'Sewer Rats')).toBe(true);
		expect(await names()).toEqual(['0:Sewer Rats']);
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id, { name: 'Elsewhere' });

		expect(await renameTeam(db, game.id, elsewhere.id, 'Hijacked')).toBe(false);
		expect(await names(other.id)).toEqual(['0:Elsewhere']);
	});
});

describe('moveTeam', () => {
	beforeEach(async () => {
		for (const name of ['A', 'B', 'C']) await seedTeam(db, game.id, { name });
	});

	it('swaps a team with the one above it', async () => {
		const [, , c] = await listTeamsWithClaimCounts(db, game.id);

		expect(await moveTeam(db, game.id, c.id, -1)).toBe(true);
		expect(await names()).toEqual(['0:A', '1:C', '2:B']);
	});

	it('does nothing past either end', async () => {
		const [a, , c] = await listTeamsWithClaimCounts(db, game.id);

		expect(await moveTeam(db, game.id, a.id, -1)).toBe(false);
		expect(await moveTeam(db, game.id, c.id, 1)).toBe(false);
		expect(await names()).toEqual(['0:A', '1:B', '2:C']);
	});

	it('closes gaps in positions while moving', async () => {
		const d = await seedTeam(db, game.id, { name: 'D', position: 7 });

		await moveTeam(db, game.id, d.id, -1);

		expect(await names()).toEqual(['0:A', '1:B', '2:D', '3:C']);
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id);

		expect(await moveTeam(db, game.id, elsewhere.id, -1)).toBe(false);
	});
});

describe('deleteTeam', () => {
	it('deletes a team without claims and closes the gap it leaves', async () => {
		await seedTeam(db, game.id, { name: 'A' });
		const b = await seedTeam(db, game.id, { name: 'B' });
		await seedTeam(db, game.id, { name: 'C' });

		expect(await deleteTeam(db, game.id, b.id)).toBe('deleted');
		expect(await names()).toEqual(['0:A', '1:C']);
	});

	it('keeps a team that has any claim, even a rejected one', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		await seedClaim(db, rats.id, (await seedChallenge(db, game.id)).id, { status: 'rejected' });

		expect(await deleteTeam(db, game.id, rats.id)).toBe('has-claims');
		expect(await names()).toEqual(['0:Canal Rats']);
	});

	it('reports a team of another game as not found', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id);

		expect(await deleteTeam(db, game.id, elsewhere.id)).toBe('not-found');
		expect(await listTeamsWithClaimCounts(db, other.id)).toHaveLength(1);
	});
});

describe('setArrival', () => {
	it('records, corrects and clears the arrival time', async () => {
		const rats = await seedTeam(db, game.id);

		expect(await setArrival(db, game.id, rats.id, '2026-06-01T21:03:00.000Z')).toBe(true);
		expect((await listTeamsWithClaimCounts(db, game.id))[0].arrived_at).toBe(
			'2026-06-01T21:03:00.000Z'
		);

		await setArrival(db, game.id, rats.id, '2026-06-01T20:58:00.000Z');
		expect((await listTeamsWithClaimCounts(db, game.id))[0].arrived_at).toBe(
			'2026-06-01T20:58:00.000Z'
		);

		await setArrival(db, game.id, rats.id, null);
		expect((await listTeamsWithClaimCounts(db, game.id))[0].arrived_at).toBeNull();
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const outsider = await seedTeam(db, other.id);

		expect(await setArrival(db, game.id, outsider.id, '2026-06-01T21:03:00.000Z')).toBe(false);
	});
});
