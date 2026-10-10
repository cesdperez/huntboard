import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { requireAdminGame } from '#lib/server/admin-game.js';
import {
	addTeamAdjustment,
	clearArrival,
	correctArrival,
	recordArrival,
	removeAdjustment,
	type TeamScoresOutcome
} from '#lib/server/team-scores.js';
import type { AdminAction, AdminActions } from './types.js';

function respond({ status, result }: TeamScoresOutcome) {
	return status === 200 ? { teamScores: result } : fail(status, { teamScores: result });
}

function teamScoresAction(
	act: (db: D1Database, gameId: number, data: FormData) => Promise<TeamScoresOutcome>
): AdminAction {
	return async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		return respond(await act(env.DB, game.id, await request.formData()));
	};
}

/** Teams tab actions. Results go under `teamScores`. They stay open after the game ends. */
export const teamScoresActions = {
	adjustmentAdd: teamScoresAction(addTeamAdjustment),
	adjustmentRemove: teamScoresAction(removeAdjustment),
	arrivalRecord: teamScoresAction((db, gameId, data) =>
		recordArrival(db, gameId, data, new Date())
	),
	arrivalCorrect: teamScoresAction(correctArrival),
	arrivalClear: teamScoresAction(clearArrival)
} satisfies AdminActions;
