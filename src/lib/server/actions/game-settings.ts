import { env } from 'cloudflare:workers';
import { respond } from './respond.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { saveGameSettings } from '#lib/server/use-cases/game-settings.js';
import { resetGameWithFiles } from '#lib/server/use-cases/images.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "gameSettings" so they cannot collide with other sections. */
export const gameSettingsActions = {
	gameSettingsSave: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		return respond('gameSettings', await saveGameSettings(env.DB, game, data));
	},

	gameSettingsReset: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		await resetGameWithFiles(env.DB, env.IMAGES, env.MEDIA, game.id);
	}
} satisfies AdminActions;
