import type { ActionResult } from '$app/forms';
import type { GamePhase } from '#lib/domain/game-window.js';
import type { TeamFormResult } from '#lib/server/team-play.js';

const RETRY = 'This did not go through. Check your connection and try again.';

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
			return result.status === 404
				? 'This link does not work any more. Ask your organiser for the current link.'
				: RETRY;
		case 'failure': {
			const team = result.data?.team as TeamFormResult | undefined;
			if (team?.kind === 'closed') return closedMessage(team.phase);
			if (team?.kind === 'error') return team.message;
			return RETRY;
		}
	}
}
