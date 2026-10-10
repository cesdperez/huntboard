import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { GAME_DATA } from '#lib/live-updates.js';
import { requireTeamLink } from '#lib/server/team-link.js';
import { getTeamPage } from '#lib/server/team-page.js';
import {
	markDone,
	renameOwnTeam,
	undoOwnClaim,
	type TeamActionOutcome
} from '#lib/server/team-play.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(GAME_DATA);
	const { team, game } = await requireTeamLink(params.token);
	return getTeamPage(env.DB, team, game);
};

function respond({ status, result }: TeamActionOutcome) {
	return status === 200 ? { team: result } : fail(status, { team: result });
}

export const actions = {
	mark: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond(await markDone(env.DB, link, await request.formData(), new Date()));
	},

	undo: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond(await undoOwnClaim(env.DB, link, await request.formData(), new Date()));
	},

	rename: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond(await renameOwnTeam(env.DB, link, await request.formData()));
	}
} satisfies Actions;
