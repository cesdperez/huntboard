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
