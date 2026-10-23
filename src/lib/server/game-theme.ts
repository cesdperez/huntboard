import { resolveTheme } from '#lib/themes/index.js';
import type { GameRow } from './db/types.js';

/**
 * Themes a team or scoreboard page with its game's theme: locals for the <html> the server
 * renders, page data for the root layout after client-side navigation.
 */
export function applyGameTheme(locals: App.Locals, game: Pick<GameRow, 'theme'>) {
	const gameTheme = resolveTheme(game.theme).id;
	locals.gameTheme = gameTheme;
	return { gameTheme };
}
