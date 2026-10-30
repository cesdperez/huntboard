import type { ClaimRow } from './types.js';
import { GAME_CLAIMS } from './game-claims.js';
import { nextId } from './ids.js';

/** A claim waiting in the judging queue, with what the judge needs to see beside it. */
export interface PendingClaimRow extends ClaimRow {
	team_name: string;
	challenge_title: string;
	min_points: number;
	max_points: number;
	/** Earlier rejections of the same team on the same challenge. */
	rejected_count: number;
	last_rejection_note: string | null;
}

/** Pending claims of the game, oldest first. */
export async function listPendingClaims(
	db: D1Database,
	gameId: number
): Promise<PendingClaimRow[]> {
	const { results } = await db
		.prepare(
			`SELECT claim.*, team.name AS team_name, challenge.title AS challenge_title,
				challenge.min_points, challenge.max_points,
				(SELECT count(*) FROM claim AS rejected
					WHERE rejected.team_id = claim.team_id AND rejected.challenge_id = claim.challenge_id
						AND rejected.status = 'rejected') AS rejected_count,
				(SELECT rejected.judge_note FROM claim AS rejected
					WHERE rejected.team_id = claim.team_id AND rejected.challenge_id = claim.challenge_id
						AND rejected.status = 'rejected'
					ORDER BY rejected.id DESC LIMIT 1) AS last_rejection_note
			FROM ${GAME_CLAIMS}
			JOIN challenge ON challenge.id = claim.challenge_id
			WHERE team.game_id = ? AND claim.status = 'pending'
			ORDER BY claim.marked_at, claim.id`
		)
		.bind(gameId)
		.all<PendingClaimRow>();
	return results;
}

export async function countPendingClaims(db: D1Database, gameId: number): Promise<number> {
	const count = await db
		.prepare(
			`SELECT count(*) AS n FROM ${GAME_CLAIMS}
			WHERE team.game_id = ? AND claim.status = 'pending'`
		)
		.bind(gameId)
		.first<number>('n');
	return count ?? 0;
}

/** Every claim of the game, rejected history included, oldest first. Admins only. */
export async function listGameClaims(db: D1Database, gameId: number): Promise<ClaimRow[]> {
	const { results } = await db
		.prepare(
			`SELECT claim.* FROM ${GAME_CLAIMS}
			WHERE team.game_id = ? ORDER BY claim.id`
		)
		.bind(gameId)
		.all<ClaimRow>();
	return results;
}

/** Points are clamped into the challenge range by the query. */
export type Verdict =
	{ status: 'scored'; points: number } | { status: 'rejected'; reason: string | null };

export interface Judgement {
	claimId: number;
	/**
	 * The state the judge saw. A pending claim is judged only while still pending, so the first
	 * judge wins. A scored claim can be fixed or rejected while still scored, last write wins.
	 */
	from: 'pending' | 'scored';
	verdict: Verdict;
	judgedBy: string;
}

export type JudgeResult =
	| { status: 'judged'; claim: ClaimRow }
	/** The claim is no longer in the state the judge saw: as it is now. */
	| { status: 'conflict'; claim: ClaimRow }
	| { status: 'not-found' };

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
const CLAMPED_POINTS = `(SELECT MAX(min_points, MIN(max_points, ?)) FROM challenge WHERE challenge.id = claim.challenge_id)`;

export async function judgeClaim(
	db: D1Database,
	gameId: number,
	{ claimId, from, verdict, judgedBy }: Judgement
): Promise<JudgeResult> {
	const update =
		verdict.status === 'scored'
			? db
					.prepare(
						`UPDATE claim SET status = 'scored', points = ${CLAMPED_POINTS}, judge_note = NULL,
							judged_by = ?, judged_at = ${NOW}
						WHERE id = ? AND status = ? AND team_id IN (SELECT id FROM team WHERE game_id = ?)
						RETURNING *`
					)
					.bind(verdict.points, judgedBy, claimId, from, gameId)
			: db
					.prepare(
						`UPDATE claim SET status = 'rejected', points = NULL, judge_note = ?,
							judged_by = ?, judged_at = ${NOW}
						WHERE id = ? AND status = ? AND team_id IN (SELECT id FROM team WHERE game_id = ?)
						RETURNING *`
					)
					.bind(verdict.reason, judgedBy, claimId, from, gameId);

	// One batch is one transaction: the SELECT sees the claim exactly as the UPDATE found it.
	const [judged, current] = await db.batch<ClaimRow>([
		update,
		db
			.prepare(
				`SELECT claim.* FROM claim JOIN team ON team.id = claim.team_id
				WHERE claim.id = ? AND team.game_id = ?`
			)
			.bind(claimId, gameId)
	]);
	if (judged.results[0]) return { status: 'judged', claim: judged.results[0] };
	return current.results[0]
		? { status: 'conflict', claim: current.results[0] }
		: { status: 'not-found' };
}

export interface DirectScore {
	teamId: number;
	challengeId: number;
	/** Clamped into the challenge range by the query. */
	points: number;
	judgedBy: string;
}

/** Scores an open cell for proof that came in person: a scored claim the admin marked and judged. */
export async function scoreWithoutClaim(
	db: D1Database,
	gameId: number,
	{ teamId, challengeId, points, judgedBy }: DirectScore
): Promise<JudgeResult> {
	const [scored, active] = await db.batch<ClaimRow>([
		// The only conflict possible is the one active claim per team and challenge.
		db
			.prepare(
				`INSERT INTO claim
					(id, team_id, challenge_id, status, marked_by, points, judged_by, judged_at)
				SELECT ${nextId('claim')}, team.id, challenge.id, 'scored', ?1, MAX(challenge.min_points, MIN(challenge.max_points, ?2)),
					?1, ${NOW}
				FROM team, challenge
				WHERE team.id = ?3 AND team.game_id = ?5 AND challenge.id = ?4 AND challenge.game_id = ?5
				ON CONFLICT DO NOTHING
				RETURNING *`
			)
			.bind(judgedBy, points, teamId, challengeId, gameId),
		db
			.prepare(
				`SELECT claim.* FROM claim JOIN team ON team.id = claim.team_id
				WHERE claim.team_id = ? AND claim.challenge_id = ? AND team.game_id = ?
					AND claim.status IN ('pending', 'scored')`
			)
			.bind(teamId, challengeId, gameId)
	]);
	if (scored.results[0]) return { status: 'judged', claim: scored.results[0] };
	return active.results[0]
		? { status: 'conflict', claim: active.results[0] }
		: { status: 'not-found' };
}
