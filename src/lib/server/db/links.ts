import { generateToken } from '#lib/domain/token.js';
import { getGameById } from './games.js';
import type { GameRow, TeamRow } from './types.js';

/** The team a team token opens, with its game. */
export interface TeamLink {
	team: TeamRow;
	game: GameRow;
}

/** Gives the game a new admin token. The old admin link stops working at once. */
export async function rotateAdminToken(db: D1Database, gameId: number): Promise<string> {
	const token = generateToken();
	await db.prepare('UPDATE game SET admin_token = ? WHERE id = ?').bind(token, gameId).run();
	return token;
}

/** Gives the game a new scoreboard token. The old scoreboard link stops working at once. */
export async function rotateScoreboardToken(db: D1Database, gameId: number): Promise<string> {
	const token = generateToken();
	await db.prepare('UPDATE game SET scoreboard_token = ? WHERE id = ?').bind(token, gameId).run();
	return token;
}

/** Gives the team a new token, or returns null when the team is not in this game. */
export async function rotateTeamToken(
	db: D1Database,
	gameId: number,
	teamId: number
): Promise<string | null> {
	return db
		.prepare('UPDATE team SET token = ? WHERE id = ? AND game_id = ? RETURNING token')
		.bind(generateToken(), teamId, gameId)
		.first<string>('token');
}

export function getGameByScoreboardToken(db: D1Database, token: string): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM game WHERE scoreboard_token = ?').bind(token).first<GameRow>();
}

export function getTeamByToken(db: D1Database, token: string): Promise<TeamRow | null> {
	return db.prepare('SELECT * FROM team WHERE token = ?').bind(token).first<TeamRow>();
}

export async function findTeamLink(db: D1Database, token: string): Promise<TeamLink | null> {
	const team = await getTeamByToken(db, token);
	if (!team) return null;
	const game = await getGameById(db, team.game_id);
	return game && { team, game };
}
