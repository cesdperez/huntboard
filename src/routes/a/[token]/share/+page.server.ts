import { env } from 'cloudflare:workers';
import { linksActions } from '#lib/server/actions/links.js';
import { listTeamLinks } from '#lib/server/db/teams.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { game } = await parent();
	return { teams: await listTeamLinks(env.DB, game.id) };
};

export const actions = { ...linksActions } satisfies Actions;
