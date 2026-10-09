import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { getGameByAdminToken } from './db/games.js';
import type { GameRow } from './db/types.js';

/** The game an admin token opens. Throws a 404 for an unknown or rotated token. */
export async function requireAdminGame(token: string): Promise<GameRow> {
	const game = await getGameByAdminToken(env.DB, token);
	if (!game) error(404, 'Not found');
	return game;
}
