import type { ActionOutcome } from './action-outcome.js';
import { countGamesCreatedToday, createGame } from '../db/games.js';
import { readString } from './form.js';
import { gameNameError } from './game-settings-form.js';

/** Each game can hold gigabytes of media, so this caps what one account can make the bucket store. */
export const GAMES_PER_DAY = 10;

/** What /new shows again after a refused attempt. */
export interface NewGameFormResult {
	name: string;
	error: string;
}

/** The new game's admin token, or why no game was created. */
export type NewGameOutcome = { adminToken: string } | ActionOutcome<NewGameFormResult>;

/** Creates a game owned by the signed-in user. */
export async function createNewGame(
	db: D1Database,
	ownerUserId: number,
	data: FormData
): Promise<NewGameOutcome> {
	const name = readString(data, 'name');

	const nameError = gameNameError(name);
	if (nameError) return { status: 400, result: { name, error: nameError } };

	if ((await countGamesCreatedToday(db, ownerUserId)) >= GAMES_PER_DAY) {
		return {
			status: 429,
			result: { name, error: `You can create ${GAMES_PER_DAY} games a day. Try again tomorrow.` }
		};
	}

	const game = await createGame(db, name, ownerUserId);
	return { adminToken: game.admin_token };
}
