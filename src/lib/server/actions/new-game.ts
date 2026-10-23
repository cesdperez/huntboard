import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { createNewGame } from '#lib/server/use-cases/new-game.js';
import type { Action } from '@sveltejs/kit';

type CreationEnv = Pick<Cloudflare.Env, 'DB' | 'CREATE_GAME_CODE'>;

export function createNewGameAction(env: CreationEnv): Action {
	return async ({ request }) => {
		const outcome = await createNewGame(env.DB, env.CREATE_GAME_CODE, await request.formData());
		if ('adminToken' in outcome) {
			redirect(303, resolve('/a/[token]', { token: outcome.adminToken }));
		}
		return fail(outcome.status, outcome.result);
	};
}
