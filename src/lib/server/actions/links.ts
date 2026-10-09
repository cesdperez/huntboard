import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { requireAdminGame } from '../admin-game.js';
import { rotateAdminToken, rotateScoreboardToken, rotateTeamToken } from '../db/links.js';
import { readString } from '../form.js';
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
		return { links: { rotated: 'scoreboard' } satisfies LinksFormResult };
	},

	linksRotateTeam: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const teamId = Number(readString(await request.formData(), 'teamId'));
		const token = Number.isInteger(teamId) ? await rotateTeamToken(env.DB, game.id, teamId) : null;
		if (!token) {
			return fail(404, {
				links: {
					error: 'That team is no longer in this game. Reload the page.'
				} satisfies LinksFormResult
			});
		}
		return { links: { rotated: `team-${teamId}` } satisfies LinksFormResult };
	}
} satisfies AdminActions;
