import { ADJUSTMENTS_PER_GAME_MAX } from '#lib/domain/adjustment.js';
import { nextId } from './ids.js';
import type { AdjustmentRow } from './types.js';

export async function listAdjustments(db: D1Database, gameId: number): Promise<AdjustmentRow[]> {
	const { results } = await db
		.prepare(
			`SELECT adjustment.* FROM adjustment JOIN team ON team.id = adjustment.team_id
			WHERE team.game_id = ? ORDER BY adjustment.id`
		)
		.bind(gameId)
		.all<AdjustmentRow>();
	return results;
}

export interface NewAdjustment {
	/** Signed: positive for a bonus, negative for a penalty. */
	points: number;
	reason: string;
	createdBy: string;
	/** Adds the adjustment at most once per id. Null adds it every time. */
	requestId: string | null;
}

/** Null when the team is not in this game, or 'full' at the limit. Repeated request ids return their row. */
export async function addAdjustment(
	db: D1Database,
	gameId: number,
	teamId: number,
	{ points, reason, createdBy, requestId }: NewAdjustment
): Promise<AdjustmentRow | 'full' | null> {
	const [added, earlier, team] = await db.batch<AdjustmentRow>([
		db
			.prepare(
				`INSERT INTO adjustment (id, team_id, points, reason, created_by, request_id)
				SELECT ${nextId('adjustment')}, id, ?, ?, ?, ? FROM team WHERE id = ? AND game_id = ?
				AND (SELECT count(*) FROM adjustment JOIN team ON team.id = adjustment.team_id
					WHERE team.game_id = ?) < ?
				ON CONFLICT DO NOTHING
				RETURNING *`
			)
			.bind(points, reason, createdBy, requestId, teamId, gameId, gameId, ADJUSTMENTS_PER_GAME_MAX),
		db
			.prepare(
				`SELECT adjustment.* FROM adjustment JOIN team ON team.id = adjustment.team_id
				WHERE adjustment.request_id = ? AND team.id = ? AND team.game_id = ?`
			)
			.bind(requestId, teamId, gameId),
		db.prepare('SELECT id FROM team WHERE id = ? AND game_id = ?').bind(teamId, gameId)
	]);
	return added.results[0] ?? earlier.results[0] ?? (team.results.length ? 'full' : null);
}

/** False when the adjustment is not in this game, or already gone. */
export async function deleteAdjustment(
	db: D1Database,
	gameId: number,
	adjustmentId: number
): Promise<boolean> {
	const deleted = await db
		.prepare(
			`DELETE FROM adjustment WHERE id = ?
				AND team_id IN (SELECT id FROM team WHERE game_id = ?)
			RETURNING id`
		)
		.bind(adjustmentId, gameId)
		.first<number>('id');
	return deleted !== null;
}
