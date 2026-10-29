import { generateToken } from '#lib/domain/token.js';
import { DEFAULT_THEME } from '#lib/themes/index.js';
import type { GameRow } from './types.js';

export async function createGame(
	db: D1Database,
	name: string,
	ownerUserId: number | null = null
): Promise<GameRow> {
	const game = await db
		.prepare(
			`INSERT INTO game (name, admin_token, scoreboard_token, theme, owner_user_id)
			VALUES (?, ?, ?, ?, ?) RETURNING *`
		)
		.bind(name, generateToken(), generateToken(), DEFAULT_THEME.id, ownerUserId)
		.first<GameRow>();
	if (!game) throw new Error('Inserting a game returned no row');
	return game;
}

export async function countGamesCreatedToday(db: D1Database, userId: number): Promise<number> {
	const count = await db
		.prepare(
			`SELECT count(*) AS n FROM game
			WHERE owner_user_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`
		)
		.bind(userId)
		.first<number>('n');
	return count ?? 0;
}

export function getGameByAdminToken(db: D1Database, token: string): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM game WHERE admin_token = ?').bind(token).first<GameRow>();
}

export function getGameById(db: D1Database, id: number): Promise<GameRow | null> {
	return db.prepare('SELECT * FROM game WHERE id = ?').bind(id).first<GameRow>();
}

export async function listGamesByOwner(db: D1Database, userId: number): Promise<GameRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM game WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC')
		.bind(userId)
		.all<GameRow>();
	return results;
}

/** Makes the user the owner of a game nobody owns yet. False when it already has an owner. */
export async function claimGame(db: D1Database, gameId: number, userId: number): Promise<boolean> {
	const result = await db
		.prepare('UPDATE game SET owner_user_id = ? WHERE id = ? AND owner_user_id IS NULL')
		.bind(userId, gameId)
		.run();
	return result.meta.changes > 0;
}

export type GameSettings = Pick<
	GameRow,
	'name' | 'starts_at' | 'ends_at' | 'late_penalty_per_minute' | 'theme'
>;

export async function updateGameSettings(
	db: D1Database,
	gameId: number,
	settings: GameSettings
): Promise<GameRow> {
	const game = await db
		.prepare(
			`UPDATE game SET name = ?, starts_at = ?, ends_at = ?, late_penalty_per_minute = ?, theme = ?
			WHERE id = ? RETURNING *`
		)
		.bind(
			settings.name,
			settings.starts_at,
			settings.ends_at,
			settings.late_penalty_per_minute,
			settings.theme,
			gameId
		)
		.first<GameRow>();
	if (!game) throw new Error(`No game with id ${gameId}`);
	return game;
}

/** Returns the game to how /new created it, except that the name, theme and links stay. The caller deletes the images. */
export async function resetGame(db: D1Database, gameId: number): Promise<GameRow> {
	// Claims, adjustments and arrivals go with their team through ON DELETE CASCADE.
	const [, , reset] = await db.batch<GameRow>([
		db.prepare('DELETE FROM team WHERE game_id = ?').bind(gameId),
		db.prepare('DELETE FROM challenge WHERE game_id = ?').bind(gameId),
		db
			.prepare(
				`UPDATE game SET starts_at = NULL, ends_at = NULL, late_penalty_per_minute = 0,
					image_key = NULL, image_label = ''
				WHERE id = ? RETURNING *`
			)
			.bind(gameId)
	]);
	const game = reset.results[0];
	if (!game) throw new Error(`No game with id ${gameId}`);
	return game;
}
