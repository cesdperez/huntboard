import { redirect } from '@sveltejs/kit';
import { nextPath } from '#lib/domain/account.js';
import { googleAction } from '#lib/server/actions/sign-in.js';
import { googleClient } from '#lib/server/http/google.js';
import { getSignedInUser } from '#lib/server/http/session.js';
import { takeFlashError } from '#lib/server/http/sign-in-attempt.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const next = nextPath(url.searchParams.get('next'));
	if (await getSignedInUser(cookies)) redirect(303, next);
	return {
		next,
		googleEnabled: googleClient(url) !== null,
		error: takeFlashError(cookies)
	};
};

export const actions = { google: googleAction } satisfies Actions;
