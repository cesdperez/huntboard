import { plural } from '../plural.js';
import type { GamePhase, GameWindow } from './game-window.js';
import type { ClaimStatus } from './scoring.js';
import type { TeamClaim } from './team-board.js';

export interface ConflictingClaim {
	status: ClaimStatus;
	markedBy: string;
	judgedBy: string | null;
	points: number | null;
}

/** Why a claim could not be marked or undone, naming the person who got there first. */
export function claimConflictMessage(claim: ConflictingClaim): string {
	const judge = judgeName(claim.judgedBy);
	switch (claim.status) {
		case 'pending':
			return `${claim.markedBy} already marked this done.`;
		case 'scored':
			return `${judge} already scored this: ${plural(claim.points ?? 0, 'point')}.`;
		case 'rejected':
			return `${judge} already rejected this.`;
	}
}

/** Why a team cannot mark or undo claims outside the game window. formatTime shows a UTC ISO time to the viewer. */
export function claimsClosedMessage(
	phase: Exclude<GamePhase, 'during'>,
	window: GameWindow,
	formatTime: (iso: string) => string
): string {
	if (phase === 'after' && window.endsAt) {
		return `The game ended at ${formatTime(window.endsAt)}. Claims are closed.`;
	}
	if (!window.startsAt) return 'The game has no start time yet. Claims open once it starts.';
	if (!window.endsAt) {
		return 'The game has no end time yet. Claims open once the organiser sets it.';
	}
	return `The game starts at ${formatTime(window.startsAt)}. Claims open then.`;
}

/** Who handled a claim, under its state in the team sheet, or null when there is nothing to say. */
export function claimLine(
	claim: Pick<TeamClaim, 'status' | 'markedBy' | 'markedAt' | 'judgedBy'>,
	formatTime: (iso: string) => string
): string | null {
	switch (claim.status) {
		case 'pending':
			return `Marked done by ${claim.markedBy} at ${formatTime(claim.markedAt)}.`;
		case 'scored':
			return claim.judgedBy ? `Judged by ${claim.judgedBy}.` : null;
		case 'rejected':
			return `${judgeName(claim.judgedBy)} rejected this. You can mark it done again.`;
	}
}

function judgeName(judgedBy: string | null): string {
	return judgedBy ?? 'A judge';
}
