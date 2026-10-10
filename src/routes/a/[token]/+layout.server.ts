import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/live-updates.js';
import { requireAdminGame } from '#lib/server/admin-game.js';
import { countPendingClaims } from '#lib/server/db/judging.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, depends }) => {
	depends(GAME_DATA);
	const game = await requireAdminGame(params.token);
	return { game, pendingCount: await countPendingClaims(env.DB, game.id) };
};
