import { env } from 'cloudflare:workers';
import { requireAdminGame } from '#lib/server/http/admin-game.js';
import { gameMediaZip } from '#lib/server/use-cases/claim-media.js';
import type { RequestHandler } from './$types';

/** Zipping takes seconds of CPU for a full game, so this needs Workers Paid. */
export const GET: RequestHandler = async ({ params }) =>
	gameMediaZip(env.DB, env.MEDIA, await requireAdminGame(params.token));
