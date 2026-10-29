import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { redirect } from '@sveltejs/kit';
import { nextPath } from '#lib/domain/account.js';
import { emailSignInActions, pendingEmail } from '#lib/server/actions/email-sign-in.js';
import { getSignedInUser } from '#lib/server/http/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const next = nextPath(url.searchParams.get('next'));
	if (await getSignedInUser(cookies)) redirect(303, next);
	return { next, pendingEmail: await pendingEmail(env, cookies) };
};

export const actions = emailSignInActions(env, dev) satisfies Actions;
