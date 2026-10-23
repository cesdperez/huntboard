import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { creationCodeMatches } from '#lib/server/use-cases/creation-code.js';
import { createGame } from '#lib/server/db/games.js';
import { readString } from '#lib/server/http/form.js';
import { gameNameError } from '#lib/server/http/game-settings-form.js';
import type { Action } from '@sveltejs/kit';

type CreationEnv = Pick<Cloudflare.Env, 'DB' | 'CREATE_GAME_CODE'>;

export function createNewGameAction(env: CreationEnv): Action {
	return async ({ request }) => {
		const data = await request.formData();
		const code = readString(data, 'code');
		const name = readString(data, 'name');

		const nameError = gameNameError(name);
		if (nameError) return fail(400, { name, error: nameError });
		if (!(await creationCodeMatches(code, env.CREATE_GAME_CODE))) {
			return fail(403, { name, error: 'That creation code is not right. Check it and try again.' });
		}

		const game = await createGame(env.DB, name);
		redirect(303, resolve('/a/[token]', { token: game.admin_token }));
	};
}
