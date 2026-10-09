import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { getGameByScoreboardToken } from '#lib/server/db/links.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const game = await getGameByScoreboardToken(env.DB, params.token);
	if (!game) error(404, 'Not found');
	return { game: { name: game.name } };
};
