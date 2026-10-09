import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { creationCodeMatches } from '#lib/server/creation-code.js';
import { createGame } from '#lib/server/db/games.js';
import { readString } from '#lib/server/form.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const code = readString(data, 'code');
		const name = readString(data, 'name');

		if (!name) return fail(400, { name, error: 'Give the game a name.' });
		if (!(await creationCodeMatches(code, env.CREATE_GAME_CODE))) {
			return fail(403, { name, error: 'That creation code is not right. Check it and try again.' });
		}

		const game = await createGame(env.DB, name);
		redirect(303, resolve('/a/[token]', { token: game.admin_token }));
	}
};
