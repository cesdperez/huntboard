import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { joinTeam } from '#lib/server/use-cases/join-team.js';
import type { Action } from '@sveltejs/kit';

// Takes env, not env.DB: reading a binding at import time breaks the build's route analysis.
export function createJoinTeamAction(env: Pick<Cloudflare.Env, 'DB'>): Action {
	return async ({ request }) => {
		const outcome = await joinTeam(env.DB, await request.formData());
		if ('token' in outcome) redirect(303, resolve('/t/[token]', { token: outcome.token }));
		return fail(outcome.status, outcome.result);
	};
}
