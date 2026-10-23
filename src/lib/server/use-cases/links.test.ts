import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameByAdminToken } from '../db/games.js';
import { getGameByScoreboardToken, getTeamByToken } from '../db/links.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedTeam } from '../db/testing/seed.js';
import type { GameRow, TeamRow } from '../db/types.js';
import { rotateAdminLink, rotateScoreboardLink, rotateTeamLink } from './links.js';

const MISSING = 'That team is no longer in this game. Reload the page.';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('rotateAdminLink', () => {
	it('returns the new admin token, and the old one stops opening the game', async () => {
		const token = await rotateAdminLink(db, game.id);

		expect(token).not.toBe(game.admin_token);
		expect(await getGameByAdminToken(db, token)).toMatchObject({ id: game.id });
		expect(await getGameByAdminToken(db, game.admin_token)).toBeNull();
	});
});

describe('rotateScoreboardLink', () => {
	it('replaces the scoreboard token', async () => {
		const outcome = await rotateScoreboardLink(db, game.id);

		expect(outcome).toEqual({ status: 200, result: { rotated: 'scoreboard' } });
		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toBeNull();
	});
});

describe('rotateTeamLink', () => {
	it('replaces the team token', async () => {
		const outcome = await rotateTeamLink(db, game.id, form({ teamId: String(rats.id) }));

		expect(outcome).toEqual({ status: 200, result: { rotated: `team-${rats.id}` } });
		expect(await getTeamByToken(db, rats.token)).toBeNull();
	});

	it.each(['', 'abc', '0', '-1'])('answers 404 for team id %j', async (teamId) => {
		const outcome = await rotateTeamLink(db, game.id, form({ teamId }));

		expect(outcome).toEqual({ status: 404, result: { error: MISSING } });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});

	it('answers 404 for a team in another game', async () => {
		const other = await createGame(db, 'Pier hunt');

		const outcome = await rotateTeamLink(db, other.id, form({ teamId: String(rats.id) }));

		expect(outcome).toEqual({ status: 404, result: { error: MISSING } });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});
});
