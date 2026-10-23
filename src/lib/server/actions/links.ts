import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { respond } from './respond.js';
import { requireAdminGame } from '../http/admin-game.js';
import { rotateAdminToken, rotateScoreboardToken, rotateTeamToken } from '../db/links.js';
import { readId } from '../http/form.js';
import type { AdminActions } from './types.js';

/** Which link a rotate action replaced: 'scoreboard' or `team-${id}`. */
export type RotatedLink = 'scoreboard' | `team-${number}`;

/** Shape of `page.form?.links` after a links action. */
export interface LinksFormResult {
	rotated?: RotatedLink;
	error?: string;
}

/** Setup tab actions. Names start with "links" so they cannot collide with other sections. */
export const linksActions = {
	linksRotateAdmin: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		const token = await rotateAdminToken(env.DB, game.id);
		redirect(303, resolve('/a/[token]/setup', { token }));
	},

	linksRotateScoreboard: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		await rotateScoreboardToken(env.DB, game.id);
		return respond('links', { status: 200, result: { rotated: 'scoreboard' } });
	},

	linksRotateTeam: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const teamId = readId(await request.formData(), 'teamId');
		const token = teamId === null ? null : await rotateTeamToken(env.DB, game.id, teamId);
		if (teamId === null || !token) {
			return respond('links', {
				status: 404,
				result: { error: 'That team is no longer in this game. Reload the page.' }
			});
		}
		return respond('links', { status: 200, result: { rotated: `team-${teamId}` } });
	}
} satisfies AdminActions;
