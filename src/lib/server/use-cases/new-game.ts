import type { ActionOutcome } from './action-outcome.js';
import { createGame } from '../db/games.js';
import { creationCodeMatches } from './creation-code.js';
import { readString } from './form.js';
import { gameNameError } from './game-settings-form.js';

/** What /new shows again after a refused attempt. */
export interface NewGameFormResult {
	name: string;
	error: string;
}

/** The new game's admin token, or why no game was created. */
export type NewGameOutcome = { adminToken: string } | ActionOutcome<NewGameFormResult>;

export async function createNewGame(
	db: D1Database,
	creationCode: string | undefined,
	data: FormData
): Promise<NewGameOutcome> {
	const code = readString(data, 'code');
	const name = readString(data, 'name');

	const nameError = gameNameError(name);
	if (nameError) return { status: 400, result: { name, error: nameError } };
	if (!(await creationCodeMatches(code, creationCode))) {
		return {
			status: 403,
			result: { name, error: 'That creation code is not right. Check it and try again.' }
		};
	}

	const game = await createGame(db, name);
	return { adminToken: game.admin_token };
}
