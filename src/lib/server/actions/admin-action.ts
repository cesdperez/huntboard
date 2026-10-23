import { env } from 'cloudflare:workers';
import type { ActionKey, ActionResults } from '#lib/action-results.js';
import type { ActionOutcome } from '#lib/server/use-cases/action-outcome.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { respond } from './respond.js';
import type { AdminAction } from './types.js';

export type AdminUseCase<R> = (
	db: D1Database,
	gameId: number,
	data: FormData
) => Promise<ActionOutcome<R>>;

/** Runs a use case on the admin token's game and puts its result under `page.form[key]`. */
export function adminAction<K extends ActionKey>(
	key: K,
	useCase: AdminUseCase<ActionResults[K]>
): AdminAction {
	return async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		return respond(key, await useCase(env.DB, game.id, await request.formData()));
	};
}
