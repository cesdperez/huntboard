import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { getTeamByToken } from '#lib/server/db/links.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const team = await getTeamByToken(env.DB, params.token);
	if (!team) error(404, 'Not found');
	return { team: { name: team.name } };
};
