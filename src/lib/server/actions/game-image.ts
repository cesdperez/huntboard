import { env } from 'cloudflare:workers';
import { respond } from '#lib/server/use-cases/action-outcome.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { removeGameImage, saveGameImage } from '#lib/server/use-cases/images.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "gameImage" so they cannot collide with other sections. */
export const gameImageActions = {
	gameImageSave: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		return respond('gameImage', await saveGameImage(env.DB, env.IMAGES, game, data));
	},

	gameImageRemove: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		await removeGameImage(env.DB, env.IMAGES, game.id);
		return respond('gameImage', { status: 200, result: {} });
	}
} satisfies AdminActions;
