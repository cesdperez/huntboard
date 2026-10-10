import { claimConflictMessage } from '#lib/domain/claim-messages.js';
import type { ClaimRow } from './db/types.js';

/** Why a claim could not be changed, naming whoever changed it first. */
export function conflictMessage(claim: ClaimRow): string {
	return claimConflictMessage({
		status: claim.status,
		markedBy: claim.marked_by,
		judgedBy: claim.judged_by,
		points: claim.points
	});
}
