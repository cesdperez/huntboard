import type { ActionResult } from '$app/forms';
import { DEAD_LINK_MESSAGE } from '#lib/dead-link.js';
import type { GamePhase } from '#lib/domain/game-window.js';
import type { TeamFormResult } from '#lib/server/team-play.js';

/** For a request that never got an answer the page understands. */
export const RETRY = 'This did not go through. Check your connection and try again.';

/** What to show after a team action, or null when it went through. */
export function actionFailureMessage(
	result: ActionResult,
	closedMessage: (phase: Exclude<GamePhase, 'during'>) => string
): string | null {
	switch (result.type) {
		case 'success':
		case 'redirect':
			return null;
		case 'error':
			return result.status === 404 ? DEAD_LINK_MESSAGE : RETRY;
		case 'failure': {
			const team = result.data?.team as TeamFormResult | undefined;
			if (team?.kind === 'closed') return closedMessage(team.phase);
			if (team?.kind === 'error') return team.message;
			return RETRY;
		}
	}
}
