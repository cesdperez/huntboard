import type { ChallengeFields, ImportPlan } from '#lib/domain/challenge-import.js';
import type { ChallengeEditFields } from '#lib/domain/challenge-edit.js';
import type { ExistingChallenge, ExistingClaim } from '#lib/domain/reimport-diff.js';
import type { ChallengeRow, ChallengeWithClaimCount } from './types.js';

/** The challenge list as teams see it. No claim counts, because those would show other teams' progress. */
export async function listChallenges(db: D1Database, gameId: number): Promise<ChallengeRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM challenge WHERE game_id = ? ORDER BY position, id')
		.bind(gameId)
		.all<ChallengeRow>();
	return results;
}

export async function listChallengesWithClaimCounts(
	db: D1Database,
	gameId: number
): Promise<ChallengeWithClaimCount[]> {
	const { results } = await db
		.prepare(
			`SELECT challenge.*,
				(SELECT count(*) FROM claim WHERE claim.challenge_id = challenge.id) AS claim_count
			FROM challenge WHERE game_id = ? ORDER BY position, id`
		)
		.bind(gameId)
		.all<ChallengeWithClaimCount>();
	return results;
}

export interface ImportSource {
	existing: ExistingChallenge[];
	/** Names of the teams that have claims, for the clamped score warnings. */
	teamNames: Map<number, string>;
}

interface ImportSourceRow {
	id: number;
	title: string;
	claim_id: number | null;
	team_id: number | null;
	team_name: string | null;
	status: ExistingClaim['status'] | null;
	points: number | null;
}

/** The stored challenges and claims that a re-import is diffed against. */
export async function getImportSource(db: D1Database, gameId: number): Promise<ImportSource> {
	const { results } = await db
		.prepare(
			`SELECT challenge.id, challenge.title, claim.id AS claim_id, claim.team_id,
				team.name AS team_name, claim.status, claim.points
			FROM challenge
			LEFT JOIN claim ON claim.challenge_id = challenge.id
			LEFT JOIN team ON team.id = claim.team_id
			WHERE challenge.game_id = ?
			ORDER BY challenge.position, challenge.id, claim.id`
		)
		.bind(gameId)
		.all<ImportSourceRow>();

	const byId = new Map<number, ExistingChallenge>();
	const teamNames = new Map<number, string>();
	for (const row of results) {
		let challenge = byId.get(row.id);
		if (!challenge) {
			challenge = { id: row.id, title: row.title, claims: [] };
			byId.set(row.id, challenge);
		}
		if (row.claim_id === null || row.team_id === null || row.status === null) continue;
		challenge.claims.push({
			id: row.claim_id,
			team_id: row.team_id,
			status: row.status,
			points: row.points
		});
		if (row.team_name !== null) teamNames.set(row.team_id, row.team_name);
	}
	return { existing: [...byId.values()], teamNames };
}

export type ApplyChallengeImportResult = { status: 'applied' } | { status: 'conflict' };

/**
 * Applies a re-import atomically. Every statement is scoped to the game, so foreign ids do nothing.
 * A conflict means another write took one of the titles since the plan was made; nothing is written.
 */
export async function applyChallengeImport(
	db: D1Database,
	gameId: number,
	plan: ImportPlan
): Promise<ApplyChallengeImportResult> {
	const unclaimedDeletes = plan.deleteIds.map((id) =>
		db
			.prepare(
				`DELETE FROM challenge WHERE id = ? AND game_id = ?
					AND NOT EXISTS (SELECT 1 FROM claim WHERE claim.challenge_id = challenge.id)`
			)
			.bind(id, gameId)
	);
	const claimedDeletes = plan.deleteWithClaimsIds.map((id) =>
		db.prepare('DELETE FROM challenge WHERE id = ? AND game_id = ?').bind(id, gameId)
	);
	const updates = plan.updates.flatMap(({ id, ...fields }) => [
		updateStatement(db, gameId, id, fields),
		clampStatement(db, gameId, id, fields)
	]);
	const inserts = plan.inserts.map((fields) =>
		db
			.prepare(
				`INSERT INTO challenge
					(game_id, title, title_key, description, section, min_points, max_points, position)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				gameId,
				fields.title,
				fields.title_key,
				fields.description,
				fields.section,
				fields.min_points,
				fields.max_points,
				fields.position
			)
	);
	// Deletes go first so their title keys are free before anything else is written.
	const statements = [...unclaimedDeletes, ...claimedDeletes, ...updates, ...inserts];
	if (statements.length === 0) return { status: 'applied' };
	try {
		await db.batch(statements);
	} catch (error) {
		if (isUniqueViolation(error)) return { status: 'conflict' };
		throw error;
	}
	return { status: 'applied' };
}

export type UpdateChallengeResult =
	| { status: 'updated'; clampedCount: number }
	| { status: 'not-found' }
	| { status: 'duplicate-title' };

/** Edits one challenge in place and clamps its scored claims to the new range. */
export async function updateChallenge(
	db: D1Database,
	gameId: number,
	challengeId: number,
	fields: ChallengeEditFields
): Promise<UpdateChallengeResult> {
	const current = await db
		.prepare('SELECT position FROM challenge WHERE id = ? AND game_id = ?')
		.bind(challengeId, gameId)
		.first<number>('position');
	if (current === null) return { status: 'not-found' };

	try {
		const [, clamped] = await db.batch([
			updateStatement(db, gameId, challengeId, { ...fields, position: current }),
			clampStatement(db, gameId, challengeId, fields)
		]);
		return { status: 'updated', clampedCount: clamped.meta.changes };
	} catch (error) {
		if (isUniqueViolation(error)) return { status: 'duplicate-title' };
		throw error;
	}
}

// The only UNIQUE constraint a challenge write can break is (game_id, title_key).
function isUniqueViolation(error: unknown): boolean {
	return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function updateStatement(
	db: D1Database,
	gameId: number,
	challengeId: number,
	fields: ChallengeFields
): D1PreparedStatement {
	return db
		.prepare(
			`UPDATE challenge SET title = ?, title_key = ?, description = ?, section = ?,
				min_points = ?, max_points = ?, position = ?
			WHERE id = ? AND game_id = ?`
		)
		.bind(
			fields.title,
			fields.title_key,
			fields.description,
			fields.section,
			fields.min_points,
			fields.max_points,
			fields.position,
			challengeId,
			gameId
		);
}

function clampStatement(
	db: D1Database,
	gameId: number,
	challengeId: number,
	{ min_points, max_points }: Pick<ChallengeFields, 'min_points' | 'max_points'>
): D1PreparedStatement {
	return db
		.prepare(
			`UPDATE claim SET points = MAX(?, MIN(?, points))
			WHERE status = 'scored' AND (points < ? OR points > ?)
				AND challenge_id IN (SELECT id FROM challenge WHERE id = ? AND game_id = ?)`
		)
		.bind(min_points, max_points, min_points, max_points, challengeId, gameId);
}
