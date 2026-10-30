import {
	checkJudgement,
	rejectClaim,
	scoreClaim,
	scoreOpenCell
} from '#lib/server/use-cases/judging.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Queue and Grid tab actions. Results go under `judge`. Judging stays open after the game ends. */
export const judgingActions = {
	judgeScore: adminAction('judge', scoreClaim),
	judgeReject: adminAction('judge', rejectClaim),
	judgeScoreOpen: adminAction('judge', scoreOpenCell),
	judgeCheck: adminAction('judge', checkJudgement)
} satisfies AdminActions;
