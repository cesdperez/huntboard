import { generateToken } from '#lib/domain/token.js';
import type { GameRow } from './types.js';

export async function createGame(db: D1Database, name: string): Promise<GameRow> {
	const game = await db
		.prepare('INSERT INTO game (name, admin_token, scoreboard_token) VALUES (?, ?, ?) RETURNING *')
		.bind(name, generateToken(), generateToken())
		.first<GameRow>();
	if (!game) throw new Error('Inserting a game returned no row');
	return game;
}

export function getGameByAdminToken(db: D1Database, token: string): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM game WHERE admin_token = ?').bind(token).first<GameRow>();
}

export type GameSettings = Pick<
	GameRow,
	'name' | 'starts_at' | 'ends_at' | 'late_penalty_per_minute'
>;

export async function updateGameSettings(
	db: D1Database,
	gameId: number,
	settings: GameSettings
): Promise<GameRow> {
	const game = await db
		.prepare(
			`UPDATE game SET name = ?, starts_at = ?, ends_at = ?, late_penalty_per_minute = ?
			WHERE id = ? RETURNING *`
		)
		.bind(
			settings.name,
			settings.starts_at,
			settings.ends_at,
			settings.late_penalty_per_minute,
			gameId
		)
		.first<GameRow>();
	if (!game) throw new Error(`No game with id ${gameId}`);
	return game;
}
