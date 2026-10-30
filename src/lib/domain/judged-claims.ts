import { judgedClaimMessage } from './claim-messages.js';
import type { TeamChallenge, TeamClaim } from './team-board.js';

/**
 * One message per claim a judge scored or rejected between two loads of a team's board, in board
 * order. The team's own actions only open and undo claims, so they never produce a message.
 */
export function judgedClaimMessages(
	before: TeamChallenge[],
	after: TeamChallenge[],
	claimsOpen: boolean
): string[] {
	const claimsBefore = new Map(before.map((c) => [c.id, c.claim]));
	return after.flatMap((challenge) => {
		const claim = challenge.claim;
		if (!claim || !wasJudged(claimsBefore.get(challenge.id) ?? null, claim)) return [];
		return [judgedClaimMessage(challenge.title, claim, claimsOpen)];
	});
}

function wasJudged(before: TeamClaim | null, after: TeamClaim): boolean {
	switch (after.status) {
		case 'pending':
			return false;
		case 'scored':
			return !(
				before?.id === after.id &&
				before.status === 'scored' &&
				before.points === after.points
			);
		case 'rejected':
			if (!before) return true;
			if (before.id === after.id) return before.status !== 'rejected';
			// An undo shows the earlier rejection again, which has a lower id than the undone claim.
			return after.id > before.id;
	}
}
