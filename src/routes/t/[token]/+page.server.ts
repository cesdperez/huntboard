import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/client/live-updates.js';
import { respond } from '#lib/server/use-cases/action-outcome.js';
import { applyGameTheme } from '#lib/server/pages/game-theme.js';
import { requireTeamLink } from '#lib/server/http/team-link.js';
import { getTeamPage } from '#lib/server/pages/team-page.js';
import {
	markDone,
	renameOwnTeam,
	saveOwnAvatar,
	undoOwnClaim
} from '#lib/server/use-cases/team-play.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends, locals }) => {
	depends(GAME_DATA);
	const { team, game } = await requireTeamLink(params.token);
	return { ...(await getTeamPage(env.DB, team, game)), ...applyGameTheme(locals, game) };
};

export const actions = {
	mark: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await markDone(env.DB, link, await request.formData(), new Date()));
	},

	undo: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await undoOwnClaim(env.DB, link, await request.formData(), new Date()));
	},

	rename: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await renameOwnTeam(env.DB, link, await request.formData()));
	},

	avatar: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await saveOwnAvatar(env.DB, env.IMAGES, link, await request.formData()));
	}
} satisfies Actions;
