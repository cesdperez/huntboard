import type { GameRow, UserRow } from '../db/types.js';

/** What Setup offers for adding the game to My games: a button, a sign-in link, or nothing. */
export async function getClaimSection(
	game: Pick<GameRow, 'owner_user_id'>,
	readUser: () => Promise<UserRow | null>
): Promise<'claim' | 'sign-in' | null> {
	// Only a game nobody owns needs to know who is looking, so owned games skip the session read.
	if (game.owner_user_id !== null) return null;
	return (await readUser()) ? 'claim' : 'sign-in';
}
