import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { requireAdminGame } from '#lib/server/admin-game.js';
import { removeGameImage, saveGameImage, type GameImageFormResult } from '#lib/server/images.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "gameImage" so they cannot collide with other sections. */
export const gameImageActions = {
	gameImageSave: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const { status, result } = await saveGameImage(
			env.DB,
			env.IMAGES,
			game,
			await request.formData()
		);
		return status === 200 ? { gameImage: result } : fail(status, { gameImage: result });
	},

	gameImageRemove: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		await removeGameImage(env.DB, env.IMAGES, game.id);
		return { gameImage: {} satisfies GameImageFormResult };
	}
} satisfies AdminActions;
