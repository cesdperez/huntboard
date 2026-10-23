import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/domain/game-data.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { getAdminLayout } from '#lib/server/pages/admin-layout.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals, depends }) => {
	depends(GAME_DATA);
	return getAdminLayout(env.DB, await requireAdminGame(params.token), locals);
};
