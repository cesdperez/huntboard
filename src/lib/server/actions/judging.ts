import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { requireAdminGame } from '#lib/server/admin-game.js';
import {
	rejectClaim,
	scoreClaim,
	scoreOpenCell,
	type JudgeActionOutcome
} from '#lib/server/judging.js';
import type { AdminAction, AdminActions } from './types.js';

function respond({ status, result }: JudgeActionOutcome) {
	return status === 200 ? { judge: result } : fail(status, { judge: result });
}

function judgeAction(
	judge: (db: D1Database, gameId: number, data: FormData) => Promise<JudgeActionOutcome>
): AdminAction {
	return async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		return respond(await judge(env.DB, game.id, await request.formData()));
	};
}

/** Queue and Grid tab actions. Results go under `judge`. Judging stays open after the game ends. */
export const judgingActions = {
	judgeScore: judgeAction(scoreClaim),
	judgeReject: judgeAction(rejectClaim),
	judgeScoreOpen: judgeAction(scoreOpenCell)
} satisfies AdminActions;
