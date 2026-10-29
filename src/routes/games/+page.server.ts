import { env } from 'cloudflare:workers';
import { requireUser } from '#lib/server/http/session.js';
import { getMyGames } from '#lib/server/pages/my-games.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => getMyGames(env.DB, await requireUser(event));
