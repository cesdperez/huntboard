import { beforeEach, describe, expect, it } from 'vitest';
import {
	TEAM_MEMBERS_ERROR,
	TEAM_MEMBERS_MAX_LENGTH,
	TEAM_NAME_ERROR
} from '#lib/domain/team-name.js';
import { createGame } from '../db/games.js';
import { listTeamsWithClaimCounts } from '../db/teams.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { GameRow, TeamRow } from '../db/types.js';
import { getTeamByToken } from '../db/links.js';
import {
	createTeam,
	editTeam,
	moveTeamDown,
	moveTeamUp,
	removeTeam,
	removeTeamPicture
} from './team-setup.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const MISSING = 'That team is not in this game any more. Reload the page.';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;
let bucket: MemoryBucket;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
	bucket = new MemoryBucket();
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

async function teamNames() {
	return (await listTeamsWithClaimCounts(db, game.id)).map((team) => team.name);
}

describe('createTeam', () => {
	it('adds the team at the end', async () => {
		const outcome = await createTeam(db, game.id, form({ name: ' Pier  Gulls ', members: 'Sam' }));

		const teams = await listTeamsWithClaimCounts(db, game.id);
		expect(outcome).toEqual({ status: 200, result: { teamId: teams[2].id } });
		expect(teams[2]).toEqual(expect.objectContaining({ name: 'Pier Gulls', members: 'Sam' }));
	});

	it('returns what was typed with the name error', async () => {
		const outcome = await createTeam(db, game.id, form({ name: '  ', members: 'Sam' }));

		expect(outcome).toEqual({
			status: 400,
			result: { error: TEAM_NAME_ERROR, name: '', members: 'Sam' }
		});
		expect(await teamNames()).toEqual(['Canal Rats', 'Night Owls']);
	});

	it('returns what was typed with the members error', async () => {
		const members = 'x'.repeat(TEAM_MEMBERS_MAX_LENGTH + 1);

		const outcome = await createTeam(db, game.id, form({ name: 'Pier Gulls', members }));

		expect(outcome).toEqual({
			status: 400,
			result: { error: TEAM_MEMBERS_ERROR, name: 'Pier Gulls', members }
		});
	});
});

describe('editTeam', () => {
	it('renames the team and sets its members', async () => {
		const outcome = await editTeam(
			db,
			game.id,
			form({ teamId: String(rats.id), name: 'Canal Kings', members: 'Sam, Alex' })
		);

		expect(outcome).toEqual({ status: 200, result: { teamId: rats.id } });
		expect((await listTeamsWithClaimCounts(db, game.id))[0]).toEqual(
			expect.objectContaining({ name: 'Canal Kings', members: 'Sam, Alex' })
		);
	});

	it('refuses a missing team id', async () => {
		const outcome = await editTeam(db, game.id, form({ teamId: 'x', name: 'Canal Kings' }));

		expect(outcome).toEqual({ status: 400, result: { error: MISSING } });
	});

	it('returns what was typed with the name error', async () => {
		const outcome = await editTeam(
			db,
			game.id,
			form({ teamId: String(rats.id), name: '', members: 'Sam' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: { error: TEAM_NAME_ERROR, teamId: rats.id, name: '', members: 'Sam' }
		});
	});

	it('returns what was typed with the members error', async () => {
		const members = 'x'.repeat(TEAM_MEMBERS_MAX_LENGTH + 1);

		const outcome = await editTeam(
			db,
			game.id,
			form({ teamId: String(rats.id), name: 'Canal Kings', members })
		);

		expect(outcome).toEqual({
			status: 400,
			result: { error: TEAM_MEMBERS_ERROR, teamId: rats.id, name: 'Canal Kings', members }
		});
	});

	it('reports a team from another game as gone', async () => {
		const other = await createGame(db, 'Other hunt');
		const stranger = await seedTeam(db, other.id, { name: 'Strangers' });

		const outcome = await editTeam(
			db,
			game.id,
			form({ teamId: String(stranger.id), name: 'Canal Kings' })
		);

		expect(outcome).toEqual({ status: 404, result: { error: MISSING, teamId: stranger.id } });
	});
});

describe('moveTeamUp and moveTeamDown', () => {
	it('moves a team one place', async () => {
		const outcome = await moveTeamUp(db, game.id, form({ teamId: String(owls.id) }));

		expect(outcome).toEqual({ status: 200, result: { teamId: owls.id } });
		expect(await teamNames()).toEqual(['Night Owls', 'Canal Rats']);
	});

	it('leaves a team already at the end where it is', async () => {
		const outcome = await moveTeamDown(db, game.id, form({ teamId: String(owls.id) }));

		expect(outcome).toEqual({ status: 200, result: { teamId: owls.id } });
		expect(await teamNames()).toEqual(['Canal Rats', 'Night Owls']);
	});

	it('refuses a missing team id', async () => {
		const outcome = await moveTeamDown(db, game.id, form({}));

		expect(outcome).toEqual({ status: 400, result: { error: MISSING } });
	});
});

describe('removeTeam', () => {
	it('deletes a team without claims, and its picture', async () => {
		const key = `${game.id}/ratsratsratsratsratsra.jpg`;
		await bucket.put(key, JPEG);
		const gulls = await seedTeam(db, game.id, { name: 'Pier Gulls', avatar_key: key });

		const outcome = await removeTeam(
			db,
			bucket.asBucket(),
			game.id,
			form({ teamId: String(gulls.id) })
		);

		expect(outcome).toEqual({ status: 200, result: {} });
		expect(await teamNames()).toEqual(['Canal Rats', 'Night Owls']);
		expect(bucket.keys()).toEqual([]);
	});

	it('keeps a team with claims', async () => {
		const swim = await seedChallenge(db, game.id);
		await seedClaim(db, rats.id, swim.id);

		const outcome = await removeTeam(
			db,
			bucket.asBucket(),
			game.id,
			form({ teamId: String(rats.id) })
		);

		expect(outcome).toEqual({
			status: 409,
			result: {
				error: 'This team has claims, so it cannot be deleted. Rename it instead.',
				teamId: rats.id
			}
		});
		expect(await teamNames()).toEqual(['Canal Rats', 'Night Owls']);
	});

	it('reports a team that is already gone', async () => {
		const outcome = await removeTeam(db, bucket.asBucket(), game.id, form({ teamId: '9999' }));

		expect(outcome).toEqual({ status: 404, result: { error: MISSING, teamId: 9999 } });
	});

	it('refuses a missing team id', async () => {
		const outcome = await removeTeam(db, bucket.asBucket(), game.id, form({ teamId: '' }));

		expect(outcome).toEqual({ status: 400, result: { error: MISSING } });
	});
});

describe('removeTeamPicture', () => {
	it('clears the picture and deletes the object', async () => {
		const key = `${game.id}/ratsratsratsratsratsra.jpg`;
		await bucket.put(key, JPEG);
		const gulls = await seedTeam(db, game.id, { avatar_key: key });

		const outcome = await removeTeamPicture(
			db,
			bucket.asBucket(),
			game.id,
			form({ teamId: String(gulls.id) })
		);

		expect(outcome).toEqual({ status: 200, result: { teamId: gulls.id } });
		expect(await getTeamByToken(db, gulls.token)).toMatchObject({ avatar_key: null });
		expect(bucket.keys()).toEqual([]);
	});

	it('reports a team from another game as gone', async () => {
		const other = await createGame(db, 'Other hunt');
		const stranger = await seedTeam(db, other.id);

		const outcome = await removeTeamPicture(
			db,
			bucket.asBucket(),
			game.id,
			form({ teamId: String(stranger.id) })
		);

		expect(outcome).toEqual({ status: 404, result: { error: MISSING, teamId: stranger.id } });
	});

	it('refuses a missing team id', async () => {
		const outcome = await removeTeamPicture(db, bucket.asBucket(), game.id, form({}));

		expect(outcome).toEqual({ status: 400, result: { error: MISSING } });
	});
});
