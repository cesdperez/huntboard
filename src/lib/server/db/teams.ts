import { moveItem } from '#lib/domain/reorder.js';
import { generateToken } from '#lib/domain/token.js';
import type { TeamRow, TeamWithClaimCount } from './types.js';

export async function listTeamsWithClaimCounts(
	db: D1Database,
	gameId: number
): Promise<TeamWithClaimCount[]> {
	const { results } = await db
		.prepare(
			`SELECT team.*, (SELECT count(*) FROM claim WHERE claim.team_id = team.id) AS claim_count
			FROM team WHERE game_id = ? ORDER BY position, id`
		)
		.bind(gameId)
		.all<TeamWithClaimCount>();
	return results;
}

export async function listTeamNames(
	db: D1Database,
	gameId: number
): Promise<Pick<TeamRow, 'id' | 'name'>[]> {
	const { results } = await db
		.prepare('SELECT id, name FROM team WHERE game_id = ? ORDER BY position, id')
		.bind(gameId)
		.all<Pick<TeamRow, 'id' | 'name'>>();
	return results;
}

/** Adds a team after the last one, with a fresh link token. */
export async function addTeam(db: D1Database, gameId: number, name: string): Promise<TeamRow> {
	const team = await db
		.prepare(
			`INSERT INTO team (game_id, name, token, position)
			SELECT ?1, ?2, ?3, coalesce(max(position) + 1, 0) FROM team WHERE game_id = ?1
			RETURNING *`
		)
		.bind(gameId, name, generateToken())
		.first<TeamRow>();
	if (!team) throw new Error('Inserting a team returned no row');
	return team;
}

/** False when the team is not in this game. */
export async function renameTeam(
	db: D1Database,
	gameId: number,
	teamId: number,
	name: string
): Promise<boolean> {
	const renamed = await db
		.prepare('UPDATE team SET name = ? WHERE id = ? AND game_id = ? RETURNING id')
		.bind(name, teamId, gameId)
		.first<number>('id');
	return renamed !== null;
}

/** Records, corrects or (with null) clears when the team reached the meeting point. False when it is not in this game. */
export async function setArrival(
	db: D1Database,
	gameId: number,
	teamId: number,
	arrivedAt: string | null
): Promise<boolean> {
	const updated = await db
		.prepare('UPDATE team SET arrived_at = ? WHERE id = ? AND game_id = ? RETURNING id')
		.bind(arrivedAt, teamId, gameId)
		.first<number>('id');
	return updated !== null;
}

/** Moves a team one place up (-1) or down (1). False when it is not in this game or already at that end. */
export async function moveTeam(
	db: D1Database,
	gameId: number,
	teamId: number,
	offset: -1 | 1
): Promise<boolean> {
	const { results } = await db
		.prepare('SELECT id FROM team WHERE game_id = ? ORDER BY position, id')
		.bind(gameId)
		.all<{ id: number }>();
	const order = moveItem(
		results.map((team) => team.id),
		teamId,
		offset
	);
	if (!order) return false;

	const setPosition = db.prepare('UPDATE team SET position = ? WHERE id = ?');
	await db.batch(order.map((id, position) => setPosition.bind(position, id)));
	return true;
}

export type DeleteTeamResult = 'deleted' | 'has-claims' | 'not-found';

/** Deletes a team only while it has no claims at all, then closes the gap in positions. */
export async function deleteTeam(
	db: D1Database,
	gameId: number,
	teamId: number
): Promise<DeleteTeamResult> {
	const [deleted] = await db.batch([
		db
			.prepare(
				`DELETE FROM team WHERE id = ? AND game_id = ?
				AND NOT EXISTS (SELECT 1 FROM claim WHERE claim.team_id = team.id)`
			)
			.bind(teamId, gameId),
		renumberTeams(db, gameId)
	]);
	if (deleted.meta.changes > 0) return 'deleted';

	const exists = await db
		.prepare('SELECT 1 AS found FROM team WHERE id = ? AND game_id = ?')
		.bind(teamId, gameId)
		.first<number>('found');
	return exists ? 'has-claims' : 'not-found';
}

function renumberTeams(db: D1Database, gameId: number): D1PreparedStatement {
	return db
		.prepare(
			`UPDATE team SET position = ranked.position
			FROM (SELECT id, row_number() OVER (ORDER BY position, id) - 1 AS position
				FROM team WHERE game_id = ?) AS ranked
			WHERE team.id = ranked.id`
		)
		.bind(gameId);
}
