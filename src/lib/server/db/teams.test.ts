import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from './games.js';
import {
	addTeam,
	deleteTeam,
	listTeamNames,
	listSetupTeams,
	moveTeam,
	recordFirstArrival,
	setArrival,
	updateTeam
} from './teams.js';
import { createTestDb } from './testing/test-db.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
});

describe('listSetupTeams', () => {
	it('lists only this game teams in position order', async () => {
		await seedTeam(db, game.id, { name: 'Second', position: 1 });
		await seedTeam(db, game.id, { name: 'First', position: 0 });
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id, { name: 'Elsewhere' });

		const teams = await listSetupTeams(db, game.id);

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

		const teams = await listSetupTeams(db, game.id);

		expect(teams).toEqual([
			{ ...rats, claim_count: 3, adjustment_count: 0 },
			{ ...owls, claim_count: 0, adjustment_count: 0 }
		]);
	});

	it('counts the adjustments of each team, which deleting it takes along', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		await seedTeam(db, game.id, { name: 'Night Owls' });
		await seedAdjustment(db, rats.id);
		await seedAdjustment(db, rats.id, { points: -5 });

		const teams = await listSetupTeams(db, game.id);

		expect(teams.map((team) => team.adjustment_count)).toEqual([2, 0]);
	});
});

describe('listTeamNames', () => {
	it('lists id and name of this game teams in position order', async () => {
		const second = await seedTeam(db, game.id, { name: 'Second', position: 1 });
		const first = await seedTeam(db, game.id, { name: 'First', position: 0 });
		await seedTeam(db, (await createGame(db, 'Other hunt')).id);

		expect(await listTeamNames(db, game.id)).toEqual([
			{ id: first.id, name: 'First' },
			{ id: second.id, name: 'Second' }
		]);
	});
});

async function names(gameId = game.id) {
	const teams = await listSetupTeams(db, gameId);
	return teams.map((team) => `${team.position}:${team.name}`);
}

describe('addTeam', () => {
	it('adds the team at the end with its own link token', async () => {
		await seedTeam(db, game.id, { name: 'Canal Rats' });

		const added = await addTeam(db, game.id, 'Night Owls', 'Ana, Bo');

		if (added.status !== 'added') throw new Error('expected the team to be added');
		const owls = added.team;
		expect(owls).toMatchObject({
			game_id: game.id,
			name: 'Night Owls',
			members: 'Ana, Bo',
			position: 1
		});
		expect(owls.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(await names()).toEqual(['0:Canal Rats', '1:Night Owls']);
	});

	it('starts at position 0 in a game without teams, whatever other games hold', async () => {
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id);

		expect(await addTeam(db, game.id, 'Canal Rats', '')).toMatchObject({
			status: 'added',
			team: { position: 0 }
		});
	});

	it('refuses a name another team in this game has, in any case', async () => {
		await seedTeam(db, game.id, { name: 'Équipe Rats' });

		expect(await addTeam(db, game.id, 'éQUIPE rats', '')).toEqual({ status: 'name-taken' });
		expect(await names()).toEqual(['0:Équipe Rats']);
	});

	it('takes a name a team in another game has', async () => {
		const other = await createGame(db, 'Other hunt');
		await seedTeam(db, other.id, { name: 'Canal Rats' });

		expect((await addTeam(db, game.id, 'Canal Rats', '')).status).toBe('added');
	});

	it('never takes the id of a deleted team, which a page not yet refreshed may still send', async () => {
		const deleted = await seedTeam(db, game.id, { name: 'Canal Rats' });
		await deleteTeam(db, game.id, deleted.id);

		const added = await addTeam(db, game.id, 'Night Owls', '');

		expect(added).toMatchObject({ status: 'added', team: { id: deleted.id + 1 } });
	});
});

describe('updateTeam', () => {
	it('changes the name and members of a team of this game', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats', members: 'Ana' });

		expect(await updateTeam(db, game.id, rats.id, { name: 'Sewer Rats', members: 'Ana, Bo' })).toBe(
			'updated'
		);
		const [team] = await listSetupTeams(db, game.id);
		expect(team).toMatchObject({ name: 'Sewer Rats', members: 'Ana, Bo' });
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id, { name: 'Elsewhere' });

		expect(await updateTeam(db, game.id, elsewhere.id, { name: 'Hijacked', members: '' })).toBe(
			'not-found'
		);
		expect(await names(other.id)).toEqual(['0:Elsewhere']);
	});

	it('refuses the name of another team in this game, in any case', async () => {
		await seedTeam(db, game.id, { name: 'Canal Rats' });
		const owls = await seedTeam(db, game.id, { name: 'Night Owls' });

		expect(await updateTeam(db, game.id, owls.id, { name: 'CANAL RATS', members: '' })).toBe(
			'name-taken'
		);
		expect(await names()).toEqual(['0:Canal Rats', '1:Night Owls']);
	});

	it('changes only the case of its own name', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });

		expect(await updateTeam(db, game.id, rats.id, { name: 'canal rats', members: '' })).toBe(
			'updated'
		);
		expect(await names()).toEqual(['0:canal rats']);
	});
});

describe('moveTeam', () => {
	beforeEach(async () => {
		for (const name of ['A', 'B', 'C']) await seedTeam(db, game.id, { name });
	});

	it('swaps a team with the one above it', async () => {
		const [, , c] = await listSetupTeams(db, game.id);

		expect(await moveTeam(db, game.id, c.id, -1)).toBe(true);
		expect(await names()).toEqual(['0:A', '1:C', '2:B']);
	});

	it('does nothing past either end', async () => {
		const [a, , c] = await listSetupTeams(db, game.id);

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

	it('keeps both moves when two judges reorder at once', async () => {
		const [a, , c] = await listSetupTeams(db, game.id);

		await Promise.all([moveTeam(db, game.id, c.id, -1), moveTeam(db, game.id, a.id, 1)]);

		expect(await names()).toEqual(['0:C', '1:A', '2:B']);
	});
});

describe('deleteTeam', () => {
	it('deletes a team without claims and closes the gap it leaves', async () => {
		await seedTeam(db, game.id, { name: 'A' });
		const b = await seedTeam(db, game.id, { name: 'B' });
		await seedTeam(db, game.id, { name: 'C' });

		expect(await deleteTeam(db, game.id, b.id)).toEqual({ status: 'deleted', avatarKey: null });
		expect(await names()).toEqual(['0:A', '1:C']);
	});

	it('returns the picture key of the deleted team, so its image can go too', async () => {
		const rats = await seedTeam(db, game.id, { avatar_key: '1/rats.webp' });

		expect(await deleteTeam(db, game.id, rats.id)).toEqual({
			status: 'deleted',
			avatarKey: '1/rats.webp'
		});
	});

	it('keeps a team that has any claim, even a rejected one', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		await seedClaim(db, rats.id, (await seedChallenge(db, game.id)).id, { status: 'rejected' });

		expect(await deleteTeam(db, game.id, rats.id)).toEqual({ status: 'has-claims' });
		expect(await names()).toEqual(['0:Canal Rats']);
	});

	it('reports a team of another game as not found', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id);

		expect(await deleteTeam(db, game.id, elsewhere.id)).toEqual({ status: 'not-found' });
		expect(await listSetupTeams(db, other.id)).toHaveLength(1);
	});
});

describe('setArrival', () => {
	it('records, corrects and clears the arrival time', async () => {
		const rats = await seedTeam(db, game.id);

		expect(await setArrival(db, game.id, rats.id, '2026-06-01T21:03:00.000Z')).toBe(true);
		expect((await listSetupTeams(db, game.id))[0].arrived_at).toBe('2026-06-01T21:03:00.000Z');

		await setArrival(db, game.id, rats.id, '2026-06-01T20:58:00.000Z');
		expect((await listSetupTeams(db, game.id))[0].arrived_at).toBe('2026-06-01T20:58:00.000Z');

		await setArrival(db, game.id, rats.id, null);
		expect((await listSetupTeams(db, game.id))[0].arrived_at).toBeNull();
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const outsider = await seedTeam(db, other.id);

		expect(await setArrival(db, game.id, outsider.id, '2026-06-01T21:03:00.000Z')).toBe(false);
	});
});

describe('recordFirstArrival', () => {
	it('records the arrival of a team that has none', async () => {
		const rats = await seedTeam(db, game.id);

		expect(await recordFirstArrival(db, game.id, rats.id, '2026-06-01T21:02:00.000Z')).toBe(
			'recorded'
		);
		expect((await listSetupTeams(db, game.id))[0].arrived_at).toBe('2026-06-01T21:02:00.000Z');
	});

	it('keeps the arrival another judge recorded first', async () => {
		const rats = await seedTeam(db, game.id);
		await recordFirstArrival(db, game.id, rats.id, '2026-06-01T21:02:00.000Z');

		expect(await recordFirstArrival(db, game.id, rats.id, '2026-06-01T21:10:00.000Z')).toBe(
			'already-recorded'
		);
		expect((await listSetupTeams(db, game.id))[0].arrived_at).toBe('2026-06-01T21:02:00.000Z');
	});

	it('refuses a team of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const outsider = await seedTeam(db, other.id);

		expect(await recordFirstArrival(db, game.id, outsider.id, '2026-06-01T21:02:00.000Z')).toBe(
			'not-found'
		);
	});
});
