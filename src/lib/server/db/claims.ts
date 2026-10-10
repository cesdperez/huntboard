import type { ClaimRow } from './types.js';

/** All claims of one team, rejected history included, oldest first. Never another team's. */
export async function listTeamClaims(db: D1Database, teamId: number): Promise<ClaimRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM claim WHERE team_id = ? ORDER BY id')
		.bind(teamId)
		.all<ClaimRow>();
	return results;
}

export interface NewClaim {
	gameId: number;
	teamId: number;
	challengeId: number;
	note: string | null;
	markedBy: string;
}

export type MarkClaimResult =
	| { status: 'marked'; claim: ClaimRow }
	/** The team already has a pending or scored claim on the challenge: this one. */
	| { status: 'conflict'; claim: ClaimRow }
	| { status: 'not-found' };

/** Adds a pending claim, unless the team already has an active one on that challenge. */
export async function markClaim(db: D1Database, claim: NewClaim): Promise<MarkClaimResult> {
	// One batch is one transaction: the SELECT must see the claim the INSERT ran into, even if
	// a teammate undoes it or a judge rejects it a moment later.
	const [marked, active] = await db.batch<ClaimRow>([
		// The only conflict possible is the one active claim per team and challenge.
		db
			.prepare(
				`INSERT INTO claim (team_id, challenge_id, status, note, marked_by)
				SELECT ?, id, 'pending', ?, ? FROM challenge WHERE id = ? AND game_id = ?
				ON CONFLICT DO NOTHING
				RETURNING *`
			)
			.bind(claim.teamId, claim.note, claim.markedBy, claim.challengeId, claim.gameId),
		db
			.prepare(
				`SELECT * FROM claim WHERE team_id = ? AND challenge_id = ? AND status IN ('pending', 'scored')`
			)
			.bind(claim.teamId, claim.challengeId)
	]);
	if (marked.results[0]) return { status: 'marked', claim: marked.results[0] };
	return active.results[0]
		? { status: 'conflict', claim: active.results[0] }
		: { status: 'not-found' };
}

export type UndoClaimResult =
	| { status: 'undone' }
	/** A judge got to it first: the claim as it is now. */
	| { status: 'conflict'; claim: ClaimRow }
	| { status: 'not-found' };

/** Removes a claim of the team only while it is still pending. */
export async function undoClaim(
	db: D1Database,
	teamId: number,
	claimId: number
): Promise<UndoClaimResult> {
	const undone = await db
		.prepare(`DELETE FROM claim WHERE id = ? AND team_id = ? AND status = 'pending' RETURNING id`)
		.bind(claimId, teamId)
		.first<number>('id');
	if (undone !== null) return { status: 'undone' };

	const claim = await db
		.prepare('SELECT * FROM claim WHERE id = ? AND team_id = ?')
		.bind(claimId, teamId)
		.first<ClaimRow>();
	return claim ? { status: 'conflict', claim } : { status: 'not-found' };
}
