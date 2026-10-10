import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/live-updates.js';
import { teamScoresActions } from '#lib/server/actions/team-scores.js';
import { getTeamScoresPage } from '#lib/server/judging-pages.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, depends }) => {
	depends(GAME_DATA);
	const { game } = await parent();
	return getTeamScoresPage(env.DB, game);
};

export const actions = { ...teamScoresActions } satisfies Actions;
