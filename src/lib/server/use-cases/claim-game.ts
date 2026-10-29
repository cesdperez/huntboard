import { claimGame as claimGameRow } from '../db/games.js';
import type { GameRow } from '../db/types.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';

export type ClaimFormResult = { kind: 'claimed' } | ErrorResult;

/** Makes the signed-in user the owner of a game created before accounts. */
export async function claimGame(
	db: D1Database,
	game: GameRow,
	userId: number
): Promise<ActionOutcome<ClaimFormResult>> {
	if (game.owner_user_id === userId) return { status: 200, result: { kind: 'claimed' } };
	if (game.owner_user_id !== null || !(await claimGameRow(db, game.id, userId))) {
		return error(409, 'Someone else already added this game to their games.');
	}
	return { status: 200, result: { kind: 'claimed' } };
}
