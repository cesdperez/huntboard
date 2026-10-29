import { listGamesByOwner } from '../db/games.js';
import type { UserRow } from '../db/types.js';

/** A game on My games: what the list shows and the admin link it opens. */
export interface MyGame {
	name: string;
	adminToken: string;
	startsAt: string | null;
	createdAt: string;
}

export async function getMyGames(db: D1Database, user: UserRow) {
	const games = await listGamesByOwner(db, user.id);
	return {
		displayName: user.display_name,
		email: user.email,
		games: games.map((game): MyGame => ({
			name: game.name,
			adminToken: game.admin_token,
			startsAt: game.starts_at,
			createdAt: game.created_at
		}))
	};
}
