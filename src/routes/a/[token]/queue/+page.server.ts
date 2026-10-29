import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/domain/game-data.js';
import { judgingActions } from '#lib/server/actions/judging.js';
import { getQueuePage } from '#lib/server/pages/judging-pages.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends }) => {
	depends(GAME_DATA);
	const { game } = await parent();
	return getQueuePage(env.DB, game.id);
};

export const actions = { ...judgingActions } satisfies Actions;
