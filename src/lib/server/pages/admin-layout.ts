import { countPendingClaims } from '../db/judging.js';
import type { GameRow } from '../db/types.js';
import { applyGameTheme } from './game-theme.js';

/** What every admin tab shows around its page: the game, its theme and the Queue badge count. */
export async function getAdminLayout(db: D1Database, game: GameRow, locals: App.Locals) {
	return {
		game,
		pendingCount: await countPendingClaims(db, game.id),
		...applyGameTheme(locals, game)
	};
}
