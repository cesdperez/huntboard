import { GAME_CLAIMS } from './game-claims.js';

/** A claim with media, named for the download. */
export interface GameMediaRow {
	claim_id: number;
	team_name: string;
	challenge_title: string;
	media_key: string;
}

/** Every claim of the game with media, rejected history included, oldest first. Admins only. */
export async function listGameMedia(db: D1Database, gameId: number): Promise<GameMediaRow[]> {
	const { results } = await db
		.prepare(
			`SELECT claim.id AS claim_id, team.name AS team_name, challenge.title AS challenge_title,
				claim.media_key
			FROM ${GAME_CLAIMS}
			JOIN challenge ON challenge.id = claim.challenge_id
			WHERE team.game_id = ? AND claim.media_key IS NOT NULL
			ORDER BY claim.id`
		)
		.bind(gameId)
		.all<GameMediaRow>();
	return results;
}

export async function countGameMedia(db: D1Database, gameId: number): Promise<number> {
	const count = await db
		.prepare(
			`SELECT count(*) AS n FROM ${GAME_CLAIMS}
			WHERE team.game_id = ? AND claim.media_key IS NOT NULL`
		)
		.bind(gameId)
		.first<number>('n');
	return count ?? 0;
}

/** Unlinks every claim of the game from its media. The claims stay. */
export async function clearGameMedia(db: D1Database, gameId: number): Promise<void> {
	await db
		.prepare(
			`UPDATE claim SET media_key = NULL
			WHERE media_key IS NOT NULL AND team_id IN (SELECT id FROM team WHERE game_id = ?)`
		)
		.bind(gameId)
		.run();
}
