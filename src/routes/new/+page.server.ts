import { env } from 'cloudflare:workers';
import { createNewGameAction } from '#lib/server/new-game.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: createNewGameAction(env)
};
