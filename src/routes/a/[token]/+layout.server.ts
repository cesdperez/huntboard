import { requireAdminGame } from '#lib/server/admin-game.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => ({
	game: await requireAdminGame(params.token)
});
