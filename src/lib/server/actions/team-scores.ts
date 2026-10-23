import {
	addTeamAdjustment,
	clearArrival,
	correctArrival,
	recordArrival,
	removeAdjustment
} from '#lib/server/use-cases/team-scores.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Teams tab actions. Results go under `teamScores`. They stay open after the game ends. */
export const teamScoresActions = {
	adjustmentAdd: adminAction('teamScores', addTeamAdjustment),
	adjustmentRemove: adminAction('teamScores', removeAdjustment),
	arrivalRecord: adminAction('teamScores', (db, gameId, data) =>
		recordArrival(db, gameId, data, new Date())
	),
	arrivalCorrect: adminAction('teamScores', correctArrival),
	arrivalClear: adminAction('teamScores', clearArrival)
} satisfies AdminActions;
