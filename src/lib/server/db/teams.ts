import { teamNameKey } from '#lib/domain/team-name.js';
import { generateToken } from '#lib/domain/token.js';
import { nextId } from './ids.js';
import type { TeamRow, SetupTeam } from './types.js';

export async function listSetupTeams(db: D1Database, gameId: number): Promise<SetupTeam[]> {
	const { results } = await db
		.prepare(
			`SELECT team.*,
				(SELECT count(*) FROM claim WHERE claim.team_id = team.id) AS claim_count,
				(SELECT count(*) FROM adjustment WHERE adjustment.team_id = team.id) AS adjustment_count
			FROM team WHERE game_id = ? ORDER BY position, id`
		)
		.bind(gameId)
		.all<SetupTeam>();
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

export type AddTeamResult = { status: 'added'; team: TeamRow } | { status: 'name-taken' };

/** Adds a team after the last one, with a fresh link token, unless another team has its name. */
export async function addTeam(
	db: D1Database,
	gameId: number,
	name: string,
	members: string
): Promise<AddTeamResult> {
	try {
		const team = await db
			.prepare(
				`INSERT INTO team (id, game_id, name, name_key, members, token, position)
				SELECT ${nextId('team')}, ?1, ?2, ?3, ?4, ?5, coalesce(max(position) + 1, 0)
				FROM team WHERE game_id = ?1
				RETURNING *`
			)
			.bind(gameId, name, teamNameKey(name), members, generateToken())
			.first<TeamRow>();
		if (!team) throw new Error('Inserting a team returned no row');
		return { status: 'added', team };
	} catch (error) {
		if (isNameTaken(error)) return { status: 'name-taken' };
		throw error;
	}
}

export type UpdateTeamResult = 'updated' | 'not-found' | 'name-taken';

export async function updateTeam(
	db: D1Database,
	gameId: number,
	teamId: number,
	{ name, members }: Pick<TeamRow, 'name' | 'members'>
): Promise<UpdateTeamResult> {
	try {
		const updated = await db
			.prepare(
				'UPDATE team SET name = ?, name_key = ?, members = ? WHERE id = ? AND game_id = ? RETURNING id'
			)
			.bind(name, teamNameKey(name), members, teamId, gameId)
			.first<number>('id');
		return updated === null ? 'not-found' : 'updated';
	} catch (error) {
		if (isNameTaken(error)) return 'name-taken';
		throw error;
	}
}

// The unique index on (game_id, name_key) refuses the write, so two judges adding one name at once cannot both pass.
function isNameTaken(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.message.includes('UNIQUE constraint failed') &&
		error.message.includes('name_key')
	);
}

/** Corrects or (with null) clears when the team reached the meeting point. False when it is not in this game. */
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

export type RecordArrivalResult = 'recorded' | 'already-recorded' | 'not-found';

/** Records when the team reached the meeting point, only while none is recorded, so the first judge wins. */
export async function recordFirstArrival(
	db: D1Database,
	gameId: number,
	teamId: number,
	arrivedAt: string
): Promise<RecordArrivalResult> {
	const [recorded, team] = await db.batch([
		db
			.prepare(
				'UPDATE team SET arrived_at = ? WHERE id = ? AND game_id = ? AND arrived_at IS NULL RETURNING id'
			)
			.bind(arrivedAt, teamId, gameId),
		db.prepare('SELECT 1 AS found FROM team WHERE id = ? AND game_id = ?').bind(teamId, gameId)
	]);
	if (recorded.results.length > 0) return 'recorded';
	return team.results.length > 0 ? 'already-recorded' : 'not-found';
}

/** Moves a team one place up (-1) or down (1), unless it is already at that end. */
export async function moveTeam(
	db: D1Database,
	gameId: number,
	teamId: number,
	offset: -1 | 1
): Promise<'moved' | 'at-end' | 'not-found'> {
	const [, swapped, team] = await db.batch([
		renumberTeams(db, gameId),
		// The join finds no neighbour past either end, so nothing moves there.
		db
			.prepare(
				`UPDATE team SET position = CASE WHEN team.id = moved.id
					THEN neighbour.position ELSE moved.position END
				FROM team AS moved JOIN team AS neighbour
					ON neighbour.game_id = moved.game_id AND neighbour.position = moved.position + ?
				WHERE moved.id = ? AND moved.game_id = ? AND team.id IN (moved.id, neighbour.id)`
			)
			.bind(offset, teamId, gameId),
		db.prepare('SELECT 1 AS found FROM team WHERE id = ? AND game_id = ?').bind(teamId, gameId)
	]);
	if (swapped.meta.changes === 2) return 'moved';
	return team.results.length > 0 ? 'at-end' : 'not-found';
}

export type DeleteTeamResult =
	{ status: 'deleted'; avatarKey: string | null } | { status: 'has-claims' | 'not-found' };

/** Deletes a team only while it has no claims at all, then closes the gap in positions. */
export async function deleteTeam(
	db: D1Database,
	gameId: number,
	teamId: number
): Promise<DeleteTeamResult> {
	const [deleted] = await db.batch<{ avatar_key: string | null }>([
		db
			.prepare(
				`DELETE FROM team WHERE id = ? AND game_id = ?
				AND NOT EXISTS (SELECT 1 FROM claim WHERE claim.team_id = team.id)
				RETURNING avatar_key`
			)
			.bind(teamId, gameId),
		renumberTeams(db, gameId)
	]);
	const row = deleted.results[0];
	if (row) return { status: 'deleted', avatarKey: row.avatar_key };

	const exists = await db
		.prepare('SELECT 1 AS found FROM team WHERE id = ? AND game_id = ?')
		.bind(teamId, gameId)
		.first<number>('found');
	return { status: exists ? 'has-claims' : 'not-found' };
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
