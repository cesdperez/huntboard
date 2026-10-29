import { env } from 'cloudflare:workers';
import { createNewGameAction } from '#lib/server/actions/new-game.js';
import { requireUser } from '#lib/server/http/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireUser(event);
};

export const actions: Actions = {
	default: createNewGameAction(env)
};
