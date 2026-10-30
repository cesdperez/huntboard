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
	const NEW_TOKEN = 'q7Zt3kV9xW2mN4pL8rB6sA';

	it('moves the game to the token the browser made, and the old one stops opening it', async () => {
		const outcome = await rotateAdminLink(db, game.id, form({ adminToken: NEW_TOKEN }));

		expect(outcome).toEqual({ token: NEW_TOKEN });
		expect(await getGameByAdminToken(db, NEW_TOKEN)).toMatchObject({ id: game.id });
		expect(await getGameByAdminToken(db, game.admin_token)).toBeNull();
	});

	it.each(['', 'short', 'q7Zt3kV9xW2mN4pL8rB6sB', 'q7Zt3kV9xW2mN4pL8rB6s/'])(
		'refuses a token not made like generateToken: %j',
		async (adminToken) => {
			const outcome = await rotateAdminLink(db, game.id, form({ adminToken }));

			expect(outcome).toMatchObject({ status: 400 });
			expect(await getGameByAdminToken(db, game.admin_token)).toMatchObject({ id: game.id });
		}
	);

	it('refuses a token another game has', async () => {
		const other = await createGame(db, 'Other hunt');

		const outcome = await rotateAdminLink(db, game.id, form({ adminToken: other.admin_token }));

		expect(outcome).toMatchObject({ status: 409 });
		expect(await getGameByAdminToken(db, game.admin_token)).toMatchObject({ id: game.id });
	});
});

const NEW_LINK = 'Hk3pW9sZ2vB7qL4mT8xN1A';

describe('rotateScoreboardLink', () => {
	it('moves the scoreboard to the token the browser made', async () => {
		const outcome = await rotateScoreboardLink(db, game.id, form({ token: NEW_LINK }));

		expect(outcome).toEqual({ status: 200, result: { rotated: 'scoreboard' } });
		expect(await getGameByScoreboardToken(db, NEW_LINK)).toMatchObject({ id: game.id });
		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toBeNull();
	});

	it('takes the same token again, so a retry after a lost answer does not rotate twice', async () => {
		await rotateScoreboardLink(db, game.id, form({ token: NEW_LINK }));

		const outcome = await rotateScoreboardLink(db, game.id, form({ token: NEW_LINK }));

		expect(outcome).toEqual({ status: 200, result: { rotated: 'scoreboard' } });
		expect(await getGameByScoreboardToken(db, NEW_LINK)).toMatchObject({ id: game.id });
	});

	it.each(['', 'short', 'Hk3pW9sZ2vB7qL4mT8xN1B'])('refuses the token %j', async (token) => {
		const outcome = await rotateScoreboardLink(db, game.id, form({ token }));

		expect(outcome).toMatchObject({ status: 400 });
		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toMatchObject({
			id: game.id
		});
	});

	it('refuses a token another game has', async () => {
		const other = await createGame(db, 'Other hunt');

		const outcome = await rotateScoreboardLink(
			db,
			game.id,
			form({ token: other.scoreboard_token })
		);

		expect(outcome).toMatchObject({ status: 409 });
		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toMatchObject({
			id: game.id
		});
	});
});

describe('rotateTeamLink', () => {
	const rotate = (gameId: number, teamId: string, token = NEW_LINK) =>
		rotateTeamLink(db, gameId, form({ teamId, token }));

	it('moves the team to the token the browser made', async () => {
		const outcome = await rotate(game.id, String(rats.id));

		expect(outcome).toEqual({ status: 200, result: { rotated: `team-${rats.id}` } });
		expect(await getTeamByToken(db, NEW_LINK)).toMatchObject({ id: rats.id });
		expect(await getTeamByToken(db, rats.token)).toBeNull();
	});

	it('takes the same token again, so a retry after a lost answer does not rotate twice', async () => {
		await rotate(game.id, String(rats.id));

		const outcome = await rotate(game.id, String(rats.id));

		expect(outcome).toEqual({ status: 200, result: { rotated: `team-${rats.id}` } });
		expect(await getTeamByToken(db, NEW_LINK)).toMatchObject({ id: rats.id });
	});

	it('refuses a token that is not made like generateToken', async () => {
		const outcome = await rotate(game.id, String(rats.id), 'short');

		expect(outcome).toMatchObject({ status: 400 });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});

	it('refuses a token another team has', async () => {
		const otherGame = await createGame(db, 'Pier hunt');
		const gulls = await seedTeam(db, otherGame.id, { name: 'Gulls' });
		await rotate(otherGame.id, String(gulls.id));

		const outcome = await rotate(game.id, String(rats.id));

		expect(outcome).toMatchObject({ status: 409 });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});

	it.each(['', 'abc', '0', '-1'])('answers 404 for team id %j', async (teamId) => {
		const outcome = await rotate(game.id, teamId);

		expect(outcome).toEqual({ status: 404, result: { error: MISSING } });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});

	it('answers 404 for a team in another game', async () => {
		const other = await createGame(db, 'Pier hunt');

		const outcome = await rotate(other.id, String(rats.id));

		expect(outcome).toEqual({ status: 404, result: { error: MISSING } });
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ id: rats.id });
	});
});
