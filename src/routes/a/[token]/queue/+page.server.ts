import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/client/live-updates.js';
import { judgingActions } from '#lib/server/actions/judging.js';
import { listPendingClaims } from '#lib/server/db/judging.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends }) => {
	depends(GAME_DATA);
	const { game } = await parent();
	return { claims: await listPendingClaims(env.DB, game.id) };
};

export const actions = { ...judgingActions } satisfies Actions;
