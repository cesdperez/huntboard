import { getGameById } from './games.js';
import type { GameRow, TeamRow } from './types.js';

/** The team a team token opens, with its game. */
export interface TeamLink {
	team: TeamRow;
	game: GameRow;
}

/** Moves the game to a new admin token. The old admin link stops working at once. False when another game has it. */
export async function rotateAdminToken(
	db: D1Database,
	gameId: number,
	token: string
): Promise<boolean> {
	const moved = await db
		.prepare(
			`UPDATE game SET admin_token = ?1
			WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM game WHERE admin_token = ?1)
			RETURNING id`
		)
		.bind(token, gameId)
		.first<number>('id');
	return moved !== null;
}

/**
 * Moves the scoreboard to token. The old scoreboard link stops working at once. The token the game
 * already has counts as moved, so a retry after a lost answer changes nothing. False when another
 * game has it.
 */
export async function rotateScoreboardToken(
	db: D1Database,
	gameId: number,
	token: string
): Promise<boolean> {
	const moved = await db
		.prepare(
			`UPDATE game SET scoreboard_token = ?1
			WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM game WHERE scoreboard_token = ?1 AND id <> ?2)
			RETURNING id`
		)
		.bind(token, gameId)
		.first<number>('id');
	return moved !== null;
}

/** Moves the team to token, like rotateScoreboardToken. */
export async function rotateTeamToken(
	db: D1Database,
	gameId: number,
	teamId: number,
	token: string
): Promise<'rotated' | 'taken' | 'not-found'> {
	const [taken, moved] = await db.batch<{ id: number }>([
		db.prepare('SELECT id FROM team WHERE token = ?1 AND id <> ?2').bind(token, teamId),
		db
			.prepare(
				`UPDATE team SET token = ?1
				WHERE id = ?2 AND game_id = ?3
					AND NOT EXISTS (SELECT 1 FROM team WHERE token = ?1 AND id <> ?2)
				RETURNING id`
			)
			.bind(token, teamId, gameId)
	]);
	if (moved.results.length > 0) return 'rotated';
	return taken.results.length > 0 ? 'taken' : 'not-found';
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
