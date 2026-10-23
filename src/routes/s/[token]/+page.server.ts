import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { GAME_DATA } from '#lib/domain/game-data.js';
import { getGameByScoreboardToken } from '#lib/server/db/links.js';
import { applyGameTheme } from '#lib/server/pages/game-theme.js';
import { getCachedScoreboardPage } from '#lib/server/pages/scoreboard-page.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends, url, locals }) => {
	depends(GAME_DATA);
	const game = await getGameByScoreboardToken(env.DB, params.token);
	if (!game) error(404, 'Not found');
	// DOM types hide the Workers default cache, and Vite dev runs in Node, which has none.
	const cache = (globalThis.caches as { default?: Cache } | undefined)?.default;
	return {
		...(await getCachedScoreboardPage(env.DB, game, url.origin, cache)),
		...applyGameTheme(locals, game)
	};
};
