import type { ClaimStatus } from './scoring.js';

export interface BoardChallenge {
	id: number;
	title: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
}

export interface BoardClaim {
	id: number;
	challenge_id: number;
	status: ClaimStatus;
	note: string | null;
	marked_by: string;
	marked_at: string;
	points: number | null;
	judged_by: string | null;
	judge_note: string | null;
}

/** The claim a team sees on a challenge. Times are UTC ISO strings. */
export interface TeamClaim {
	id: number;
	status: ClaimStatus;
	note: string | null;
	markedBy: string;
	markedAt: string;
	points: number | null;
	judgedBy: string | null;
	judgeNote: string | null;
}

export interface TeamChallenge {
	id: number;
	title: string;
	description: string | null;
	section: string | null;
	minPoints: number;
	maxPoints: number;
	/** The active claim, else the latest rejection, else null when the challenge is open. */
	claim: TeamClaim | null;
}

/** One row per challenge, in the given order, with the claim one team sees on it. Pass only that team's claims. */
export function teamBoard(challenges: BoardChallenge[], claims: BoardClaim[]): TeamChallenge[] {
	const shown = new Map<number, BoardClaim>();
	for (const claim of claims) {
		const current = shown.get(claim.challenge_id);
		if (!current || outranks(claim, current)) shown.set(claim.challenge_id, claim);
	}

	return challenges.map((challenge) => {
		const claim = shown.get(challenge.id);
		return {
			id: challenge.id,
			title: challenge.title,
			description: challenge.description,
			section: challenge.section,
			minPoints: challenge.min_points,
			maxPoints: challenge.max_points,
			claim: claim ? toTeamClaim(claim) : null
		};
	});
}

// At most one claim per challenge is active, so between rejections the higher (later) id wins.
function outranks(claim: BoardClaim, current: BoardClaim): boolean {
	const active = isActive(claim);
	if (active !== isActive(current)) return active;
	return claim.id > current.id;
}

function isActive(claim: BoardClaim): boolean {
	return claim.status !== 'rejected';
}

function toTeamClaim(claim: BoardClaim): TeamClaim {
	return {
		id: claim.id,
		status: claim.status,
		note: claim.note,
		markedBy: claim.marked_by,
		markedAt: claim.marked_at,
		points: claim.points,
		judgedBy: claim.judged_by,
		judgeNote: claim.judge_note
	};
}
