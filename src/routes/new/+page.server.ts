import { env } from 'cloudflare:workers';
import { createNewGameAction } from '#lib/server/new-game.js';
import { turnstileConfig } from '#lib/server/turnstile.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	turnstileSiteKey: turnstileConfig(env, import.meta.env.DEV)?.siteKey ?? null
});

export const actions: Actions = {
	default: createNewGameAction(env, import.meta.env.DEV)
};
