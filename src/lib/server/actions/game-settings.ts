import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { requireAdminGame } from '#lib/server/admin-game.js';
import { resetGame, updateGameSettings } from '#lib/server/db/games.js';
import { parseGameSettings, type GameSettingsErrors } from '#lib/server/game-settings-form.js';
import type { AdminActions } from './types.js';

/** What the game settings actions put under page.form.gameSettings. */
export type GameSettingsFormData = { errors?: GameSettingsErrors; saved?: true };

/** Setup tab actions. Names start with "gameSettings" so they cannot collide with other sections. */
export const gameSettingsActions = {
	gameSettingsSave: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const result = parseGameSettings(await request.formData());
		if (!result.ok) {
			return fail(400, { gameSettings: { errors: result.errors } satisfies GameSettingsFormData });
		}

		await updateGameSettings(env.DB, game.id, {
			starts_at: game.starts_at,
			ends_at: game.ends_at,
			theme: game.theme,
			...result.settings
		});
		return { gameSettings: { saved: true } satisfies GameSettingsFormData };
	},

	gameSettingsReset: async ({ params }) => {
		const game = await requireAdminGame(params.token);
		await resetGame(env.DB, game.id);
	}
} satisfies AdminActions;
