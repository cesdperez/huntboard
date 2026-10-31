import { beforeEach, describe, expect, it } from 'vitest';
import { joinCodeOf } from '#lib/domain/join-code.js';
import { generateToken } from '#lib/domain/token.js';
import { createGame, getGameByAdminToken } from './games.js';
import {
	findTeamLink,
	findTeamTokenByJoinCode,
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
		const token = 'q7Zt3kV9xW2mN4pL8rB6sA';

		expect(await rotateAdminToken(db, game.id, token)).toBe(true);

		expect(await getGameByAdminToken(db, game.admin_token)).toBeNull();
		expect(await getGameByAdminToken(db, token)).toMatchObject({
			id: game.id,
			scoreboard_token: game.scoreboard_token
		});
	});

	it('keeps the old token when another game has the new one', async () => {
		const game = await createGame(db, 'Canal hunt');
		const other = await createGame(db, 'Other hunt');

		expect(await rotateAdminToken(db, game.id, other.admin_token)).toBe(false);

		expect(await getGameByAdminToken(db, game.admin_token)).toMatchObject({ id: game.id });
	});
});

describe('rotateScoreboardToken', () => {
	const token = 'Hk3pW9sZ2vB7qL4mT8xN1A';

	it('replaces the scoreboard token and leaves the admin token alone', async () => {
		const game = await createGame(db, 'Canal hunt');

		expect(await rotateScoreboardToken(db, game.id, token)).toBe(true);

		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toBeNull();
		expect(await getGameByScoreboardToken(db, token)).toMatchObject({
			id: game.id,
			admin_token: game.admin_token
		});
	});

	it('accepts the token the game already has', async () => {
		const game = await createGame(db, 'Canal hunt');

		expect(await rotateScoreboardToken(db, game.id, game.scoreboard_token)).toBe(true);
	});

	it('keeps the old token when another game has the new one', async () => {
		const game = await createGame(db, 'Canal hunt');
		const other = await createGame(db, 'Other hunt');

		expect(await rotateScoreboardToken(db, game.id, other.scoreboard_token)).toBe(false);

		expect(await getGameByScoreboardToken(db, game.scoreboard_token)).toMatchObject({
			id: game.id
		});
	});
});

describe('rotateTeamToken', () => {
	const token = 'Hk3pW9sZ2vB7qL4mT8xN1A';

	it('replaces the team token so the old one no longer finds the team', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id);
		const other = await seedTeam(db, game.id);

		expect(await rotateTeamToken(db, game.id, team.id, token)).toBe('rotated');

		expect(await getTeamByToken(db, team.token)).toBeNull();
		expect(await getTeamByToken(db, token)).toMatchObject({ id: team.id, name: team.name });
		expect(await getTeamByToken(db, other.token)).toMatchObject({ id: other.id });
	});

	it('accepts the token the team already has', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id);

		expect(await rotateTeamToken(db, game.id, team.id, team.token)).toBe('rotated');
	});

	it('keeps the old token when another team has the new one', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id);
		const other = await seedTeam(db, game.id);

		expect(await rotateTeamToken(db, game.id, team.id, other.token)).toBe('taken');
		expect(await getTeamByToken(db, team.token)).toMatchObject({ id: team.id });
	});

	it('changes nothing for a team of another game', async () => {
		const game = await createGame(db, 'Canal hunt');
		const otherGame = await createGame(db, 'Other hunt');
		const team = await seedTeam(db, otherGame.id);

		expect(await rotateTeamToken(db, game.id, team.id, token)).toBe('not-found');
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

describe('findTeamTokenByJoinCode', () => {
	it('finds the team token whose join code it is', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id, { token: generateToken() });
		await seedTeam(db, game.id, { token: generateToken() });

		expect(await findTeamTokenByJoinCode(db, joinCodeOf(team.token))).toBe(team.token);
	});

	it('tells apart tokens that share all but the last bits of the code', async () => {
		const game = await createGame(db, 'Canal hunt');
		await seedTeam(db, game.id, { token: 'K7q4m2AAAAAAAAAAAAAAAA' });
		const team = await seedTeam(db, game.id, { token: 'K7q4m2EAAAAAAAAAAAAAAA' });

		expect(await findTeamTokenByJoinCode(db, joinCodeOf(team.token))).toBe(team.token);
	});

	it('finds nothing once the link is rotated', async () => {
		const game = await createGame(db, 'Canal hunt');
		const team = await seedTeam(db, game.id, { token: generateToken() });
		const code = joinCodeOf(team.token);

		await rotateTeamToken(db, game.id, team.id, generateToken());

		expect(await findTeamTokenByJoinCode(db, code)).toBeNull();
	});

	it('finds nothing when two teams share a code', async () => {
		const game = await createGame(db, 'Canal hunt');
		await seedTeam(db, game.id, { token: 'K7q4m2AAAAAAAAAAAAAAAA' });
		await seedTeam(db, game.id, { token: 'K7q4m2AAAAAAAAAAAAAAAQ' });

		expect(await findTeamTokenByJoinCode(db, joinCodeOf('K7q4m2AAAAAAAAAAAAAAAA'))).toBeNull();
	});
});
