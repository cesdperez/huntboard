import { env } from 'cloudflare:workers';
import { listSetupTeams } from '#lib/server/db/teams.js';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { applyGameTheme } from '#lib/server/pages/game-theme.js';
import type { PageServerLoad } from './$types';

// The page resets to the root layout for print, so it skips the admin layout's load and guard.
export const load: PageServerLoad = async ({ params, locals }) => {
	const game = await requireAdminGame(params.token);
	return {
		game,
		teams: await listSetupTeams(env.DB, game.id),
		...applyGameTheme(locals, game)
	};
};
