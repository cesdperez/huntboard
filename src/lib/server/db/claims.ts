import { nextId } from './ids.js';
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
	/** Checked against the MEDIA bucket by the caller. */
	mediaKey: string | null;
}

export type MarkClaimResult =
	| { status: 'marked'; claim: ClaimRow }
	/** The team already has a pending or scored claim on the challenge: this one. */
	| { status: 'conflict'; claim: ClaimRow }
	/** Another claim, of any team and status, already has this media key. */
	| { status: 'media-taken' }
	/** The team was deleted after its link was checked. */
	| { status: 'team-gone' }
	| { status: 'not-found' };

/** Adds a pending claim, unless the team already has an active one on that challenge. */
export async function markClaim(db: D1Database, claim: NewClaim): Promise<MarkClaimResult> {
	let marked: D1Result<ClaimRow>;
	let active: D1Result<ClaimRow>;
	let team: D1Result<ClaimRow>;
	try {
		[marked, active, team] = await db.batch<ClaimRow>(markStatements(db, claim));
	} catch (error) {
		if (isMediaKeyTaken(error)) return { status: 'media-taken' };
		throw error;
	}
	if (marked.results[0]) return { status: 'marked', claim: marked.results[0] };
	if (active.results[0]) return { status: 'conflict', claim: active.results[0] };
	return team.results[0] ? { status: 'not-found' } : { status: 'team-gone' };
}

// One batch is one transaction: the SELECT must see the claim the INSERT ran into, even if
// a teammate undoes it or a judge rejects it a moment later.
function markStatements(db: D1Database, claim: NewClaim): D1PreparedStatement[] {
	return [
		// Targeted, so a taken media key throws instead of reading as an active claim.
		db
			.prepare(
				`INSERT INTO claim (id, team_id, challenge_id, status, note, marked_by, media_key)
				SELECT ${nextId('claim')}, team.id, challenge.id, 'pending', ?1, ?2, ?3
				FROM team, challenge
				WHERE team.id = ?4 AND team.game_id = ?6 AND challenge.id = ?5 AND challenge.game_id = ?6
				ON CONFLICT (team_id, challenge_id) WHERE status IN ('pending', 'scored') DO NOTHING
				RETURNING *`
			)
			.bind(
				claim.note,
				claim.markedBy,
				claim.mediaKey,
				claim.teamId,
				claim.challengeId,
				claim.gameId
			),
		db
			.prepare(
				`SELECT * FROM claim WHERE team_id = ? AND challenge_id = ? AND status IN ('pending', 'scored')`
			)
			.bind(claim.teamId, claim.challengeId),
		// The INSERT also needs the team, so a team deleted after its link was checked reads as gone
		// instead of failing the foreign key.
		db.prepare('SELECT 1 FROM team WHERE id = ? AND game_id = ?').bind(claim.teamId, claim.gameId)
	];
}

function isMediaKeyTaken(error: unknown): boolean {
	return (
		error instanceof Error && error.message.includes('UNIQUE constraint failed: claim.media_key')
	);
}

export type UndoClaimResult =
	| { status: 'undone'; mediaKey: string | null }
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
		.prepare(
			`DELETE FROM claim WHERE id = ? AND team_id = ? AND status = 'pending' RETURNING media_key`
		)
		.bind(claimId, teamId)
		.first<Pick<ClaimRow, 'media_key'>>();
	if (undone !== null) return { status: 'undone', mediaKey: undone.media_key };

	const claim = await db
		.prepare('SELECT * FROM claim WHERE id = ? AND team_id = ?')
		.bind(claimId, teamId)
		.first<ClaimRow>();
	return claim ? { status: 'conflict', claim } : { status: 'not-found' };
}

export interface ClaimEdit {
	teamId: number;
	claimId: number;
	note: string | null;
	editedBy: string;
	/** A key is checked against the MEDIA bucket by the caller. A null key removes the media. */
	media: { kind: 'keep' } | { kind: 'set'; key: string | null };
}

export type EditClaimResult =
	/** replacedMediaKey is the object the claim no longer uses, for the caller to delete. */
	| { status: 'edited'; claim: ClaimRow; replacedMediaKey: string | null }
	/** A judge got to it first: the claim as it is now. */
	| { status: 'conflict'; claim: ClaimRow }
	/** Another claim, of any team and status, already has this media key. */
	| { status: 'media-taken' }
	| { status: 'not-found' };

/**
 * Changes the note and media of a claim of the team only while it is still pending. A replaced
 * or removed upload no longer counts against the team's media limits.
 */
export async function editClaim(db: D1Database, edit: ClaimEdit): Promise<EditClaimResult> {
	let before: D1Result<Pick<ClaimRow, 'media_key'>>;
	let edited: D1Result<ClaimRow>;
	let current: D1Result<ClaimRow>;
	try {
		[before, , edited, current] = await db.batch<ClaimRow>(editStatements(db, edit));
	} catch (error) {
		if (isMediaKeyTaken(error)) return { status: 'media-taken' };
		throw error;
	}
	const claim = edited.results[0];
	if (claim) {
		const oldKey = before.results[0]?.media_key ?? null;
		const replacedMediaKey = oldKey !== claim.media_key ? oldKey : null;
		return { status: 'edited', claim, replacedMediaKey };
	}
	return current.results[0]
		? { status: 'conflict', claim: current.results[0] }
		: { status: 'not-found' };
}

// One batch is one transaction: a judge cannot score the claim between the statements, and a
// taken media key rolls back the freed upload too.
function editStatements(db: D1Database, edit: ClaimEdit): D1PreparedStatement[] {
	const pending = `SELECT media_key FROM claim WHERE id = ?1 AND team_id = ?2 AND status = 'pending'`;
	const setsMedia = edit.media.kind === 'set' ? 1 : 0;
	const key = edit.media.kind === 'set' ? edit.media.key : null;
	return [
		db.prepare(pending).bind(edit.claimId, edit.teamId),
		db
			.prepare(
				`DELETE FROM media_upload
				WHERE ?3 AND team_id = ?2 AND key = (${pending}) AND key IS NOT ?4`
			)
			.bind(edit.claimId, edit.teamId, setsMedia, key),
		// marked_at stays, so adding a forgotten photo does not send the claim to the back of the
		// judge queue, which is ordered by it.
		db
			.prepare(
				`UPDATE claim SET note = ?3, edited_by = ?4,
					edited_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
					media_key = CASE WHEN ?5 THEN ?6 ELSE media_key END
				WHERE id = ?1 AND team_id = ?2 AND status = 'pending'
				RETURNING *`
			)
			.bind(edit.claimId, edit.teamId, edit.note, edit.editedBy, setsMedia, key),
		db.prepare('SELECT * FROM claim WHERE id = ? AND team_id = ?').bind(edit.claimId, edit.teamId)
	];
}
