import { env } from 'cloudflare:workers';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { requireUser } from '#lib/server/http/session.js';
import { claimGame } from '#lib/server/use-cases/claim-game.js';
import { respond } from './respond.js';
import type { AdminActions } from './types.js';

/** Setup tab action that adds a game made before accounts to the signed-in user's games. */
export const claimGameActions = {
	claimGame: async (event) => {
		const game = await requireAdminGame(event.params.token);
		const user = await requireUser(event);
		return respond('claim', await claimGame(env.DB, game, user.id));
	}
} satisfies AdminActions;
