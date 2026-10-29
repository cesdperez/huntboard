import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { createNewGame } from '#lib/server/use-cases/new-game.js';
import type { Action } from '@sveltejs/kit';
import { requireUser } from '../http/session.js';

// Takes env, not env.DB: reading a binding at import time breaks the build's route analysis.
export function createNewGameAction(env: Pick<Cloudflare.Env, 'DB'>): Action {
	return async (event) => {
		const user = await requireUser(event);
		const outcome = await createNewGame(env.DB, user.id, await event.request.formData());
		if ('adminToken' in outcome) {
			redirect(303, resolve('/a/[token]', { token: outcome.adminToken }));
		}
		return fail(outcome.status, outcome.result);
	};
}
