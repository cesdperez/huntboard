import { env } from 'cloudflare:workers';
import { googleClient } from '#lib/server/http/google.js';
import { requireUser } from '#lib/server/http/session.js';
import { takeFlashError } from '#lib/server/http/sign-in-attempt.js';
import { getMyGames } from '#lib/server/pages/my-games.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	return {
		...(await getMyGames(env.DB, user)),
		googleEnabled: googleClient(event.url) !== null,
		error: takeFlashError(event.cookies)
	};
};
