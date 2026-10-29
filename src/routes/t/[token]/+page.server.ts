import { env } from 'cloudflare:workers';
import { GAME_DATA } from '#lib/domain/game-data.js';
import { mediaPresigner } from '#lib/server/actions/media-presigner.js';
import { respond } from '#lib/server/actions/respond.js';
import { applyGameTheme } from '#lib/server/pages/game-theme.js';
import { requireTeamLink } from '#lib/server/http/team-link.js';
import { getTeamPage } from '#lib/server/pages/team-page.js';
import {
	markDone,
	renameOwnTeam,
	requestMediaUpload,
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
		const data = await request.formData();
		return respond('team', await markDone(env.DB, env.MEDIA, link, data, new Date()));
	},

	undo: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		const data = await request.formData();
		return respond('team', await undoOwnClaim(env.DB, env.MEDIA, link, data, new Date()));
	},

	rename: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await renameOwnTeam(env.DB, link, await request.formData()));
	},

	mediaUpload: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		const data = await request.formData();
		return respond(
			'team',
			await requestMediaUpload(env.DB, mediaPresigner(), link, data, new Date())
		);
	},

	avatar: async ({ params, request }) => {
		const link = await requireTeamLink(params.token);
		return respond('team', await saveOwnAvatar(env.DB, env.IMAGES, link, await request.formData()));
	}
} satisfies Actions;
