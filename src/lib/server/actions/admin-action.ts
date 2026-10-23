import { env } from 'cloudflare:workers';
import { respond, type ActionOutcome } from '#lib/server/action-outcome.js';
import { requireAdminGame } from '#lib/server/admin-game.js';
import type { AdminAction } from './types.js';

export type AdminUseCase<R> = (
	db: D1Database,
	gameId: number,
	data: FormData
) => Promise<ActionOutcome<R>>;

/** Runs a use case on the admin token's game and puts its result under `page.form[key]`. */
export function adminAction<R>(key: string, useCase: AdminUseCase<R>): AdminAction {
	return async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		return respond(key, await useCase(env.DB, game.id, await request.formData()));
	};
}
