import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { creationCodeMatches } from '#lib/server/creation-code.js';
import { createGame } from '#lib/server/db/games.js';
import { readString } from '#lib/server/form.js';
import { gameNameError } from '#lib/server/game-settings-form.js';
import { turnstileConfig, verifyTurnstile } from '#lib/server/turnstile.js';
import type { Action } from '@sveltejs/kit';

type CreationEnv = Pick<
	Cloudflare.Env,
	| 'DB'
	| 'CREATE_GAME_CODE'
	| 'CREATE_GAME_RATE_LIMITER'
	| 'TURNSTILE_SITE_KEY'
	| 'TURNSTILE_SECRET_KEY'
>;

/** Checks anonymous abuse controls before checking the code or creating a game. */
export function createNewGameAction(env: CreationEnv, dev: boolean): Action {
	return async ({ request, getClientAddress, setHeaders, url, fetch }) => {
		let ip: string;
		try {
			ip = getClientAddress();
			if (!ip || !env.CREATE_GAME_RATE_LIMITER) throw new Error('Missing creation limiter');
			const { success } = await env.CREATE_GAME_RATE_LIMITER.limit({ key: `huntboard:new:${ip}` });
			if (!success) {
				setHeaders({ 'Retry-After': '60' });
				return fail(429, {
					name: '',
					error: 'Too many creation attempts. Wait a minute and try again.'
				});
			}
		} catch {
			return fail(503, { name: '', error: 'Game creation is unavailable. Try again shortly.' });
		}

		const config = turnstileConfig(env, dev);
		if (!config)
			return fail(503, { name: '', error: 'Game creation is unavailable. Try again shortly.' });
		const data = await request.formData();
		const code = readString(data, 'code');
		const name = readString(data, 'name');

		const nameError = gameNameError(name);
		if (nameError) return fail(400, { name, error: nameError });
		const verification = await verifyTurnstile(
			config,
			{
				token: readString(data, 'cf-turnstile-response'),
				hostname: url.hostname,
				ip
			},
			fetch
		);
		if (verification === 'unavailable') {
			return fail(503, { name, error: 'Verification is unavailable. Try again shortly.' });
		}
		if (verification === 'invalid') {
			return fail(403, { name, error: 'Complete the verification and try again.' });
		}
		if (!(await creationCodeMatches(code, env.CREATE_GAME_CODE))) {
			return fail(403, { name, error: 'That creation code is not right. Check it and try again.' });
		}

		const game = await createGame(env.DB, name);
		redirect(303, resolve('/a/[token]', { token: game.admin_token }));
	};
}
