import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { listChallenges } from '#lib/server/db/challenges.js';
import { listTeamNames } from '#lib/server/db/teams.js';
import type { PageServerLoad } from './$types';

/** A game ready to play opens on the queue. One without teams or challenges opens on setup. */
export const load: PageServerLoad = async ({ params, parent }) => {
	// Waiting for the layout makes an unknown token a 404 here instead of a redirect to one.
	const { game } = await parent();
	const [teams, challenges] = await Promise.all([
		listTeamNames(env.DB, game.id),
		listChallenges(env.DB, game.id)
	]);
	const ready = teams.length > 0 && challenges.length > 0;
	redirect(
		307,
		ready
			? resolve('/a/[token]/queue', { token: params.token })
			: resolve('/a/[token]/setup', { token: params.token })
	);
};
