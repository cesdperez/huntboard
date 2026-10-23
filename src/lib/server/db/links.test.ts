import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameByAdminToken } from './games.js';
import {
	findTeamLink,
	getGameByScoreboardToken,
	getTeamByToken,
	rotateAdminToken,
	rotateScoreboardToken,
	rotateTeamToken
} from './links.js';
import { createTestDb } from './testing/test-db.js';
import { seedTeam } from './testing/seed.js';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

describe('rotateAdminToken', () => {
	it('replaces the admin token so the old one no longer opens the game', async () => {
		const game = await createGame(db, 'Canal hunt');

		const token = await rotateAdminToken(db, game.id);

		expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(token).not.toBe(game.admin_token);
		expect(await getGameByAdminToken(db, game.admin_token)).toBeNull();
		expect(await getGameByAdminToken(db, token)).toMatchObject({
			id: game.id,
			scoreboard_token: game.scoreboard_token
		});
	});
});

describe('rotateScoreboardToken', () => {
	it('replaces the scoreboard token and leaves the admin token alone', async () => {
		const game = await createGame(db, 'Canal hunt');

		const token = await rotateScoreboardToken(db, game.id);

		expect(token).not.toBe(game.scoreboard_token);
		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toBeNull();
		expect(await getGameByScoreboardToken(db, token)).toMatchObject({
			id: game.id,
			admin_token: game.admin_token
		});
	});
});

describe('rotateTeamToken', () => {
	it('replaces the team token so the old one no longer finds the team', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id);
		const other = await seedTeam(db, game.id);

		const token = await rotateTeamToken(db, game.id, team.id);

		expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(await getTeamByToken(db, team.token)).toBeNull();
		expect(await getTeamByToken(db, token!)).toMatchObject({ id: team.id, name: team.name });
		expect(await getTeamByToken(db, other.token)).toMatchObject({ id: other.id });
	});

	it('returns null and changes nothing for a team of another game', async () => {
		const game = await createGame(db, 'Canal hunt');
		const otherGame = await createGame(db, 'Other hunt');
		const team = await seedTeam(db, otherGame.id);

		expect(await rotateTeamToken(db, game.id, team.id)).toBeNull();
		expect(await getTeamByToken(db, team.token)).toMatchObject({ id: team.id });
	});
});

describe('getGameByScoreboardToken', () => {
	it('does not accept the admin token', async () => {
		const game = await createGame(db, 'Canal hunt');

		expect(await getGameByScoreboardToken(db, game.admin_token)).toBeNull();
	});
});

describe('findTeamLink', () => {
	it('finds the team and its game by the team token', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id, { name: 'Canal Rats' });

		expect(await findTeamLink(db, team.token)).toEqual({ team, game });
	});

	it('returns null for an unknown token', async () => {
		expect(await findTeamLink(db, 'nope')).toBeNull();
	});
});
