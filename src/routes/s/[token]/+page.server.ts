import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { GAME_DATA } from '#lib/live-updates.js';
import { getGameByScoreboardToken } from '#lib/server/db/links.js';
import { getScoreboardPage } from '#lib/server/scoreboard-page.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(GAME_DATA);
	const game = await getGameByScoreboardToken(env.DB, params.token);
	if (!game) error(404, 'Not found');
	return getScoreboardPage(env.DB, game);
};
