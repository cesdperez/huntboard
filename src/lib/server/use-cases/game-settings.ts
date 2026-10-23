import type { ActionOutcome } from './action-outcome.js';
import { updateGameSettings } from '../db/games.js';
import type { GameRow } from '../db/types.js';
import { parseGameSettings, type GameSettingsErrors } from './game-settings-form.js';

/** What the game settings actions put under page.form.gameSettings. */
export type GameSettingsFormData = { errors?: GameSettingsErrors; saved?: true };

export async function saveGameSettings(
	db: D1Database,
	game: GameRow,
	data: FormData
): Promise<ActionOutcome<GameSettingsFormData>> {
	const parsed = parseGameSettings(data);
	if (!parsed.ok) return { status: 400, result: { errors: parsed.errors } };

	await updateGameSettings(db, game.id, {
		starts_at: game.starts_at,
		ends_at: game.ends_at,
		theme: game.theme,
		...parsed.settings
	});
	return { status: 200, result: { saved: true } };
}
