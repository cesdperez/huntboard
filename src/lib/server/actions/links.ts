import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { respond } from './respond.js';
import { adminAction } from './admin-action.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import {
	rotateAdminLink,
	rotateScoreboardLink,
	rotateTeamLink
} from '#lib/server/use-cases/links.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "links" so they cannot collide with other sections. */
export const linksActions = {
	linksRotateAdmin: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		const token = await rotateAdminLink(env.DB, game.id);
		redirect(303, resolve('/a/[token]/setup', { token }));
	},

	linksRotateScoreboard: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		return respond('links', await rotateScoreboardLink(env.DB, game.id));
	},

	linksRotateTeam: adminAction('links', rotateTeamLink)
} satisfies AdminActions;
