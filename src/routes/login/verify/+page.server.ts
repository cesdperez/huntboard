import { env } from 'cloudflare:workers';
import { linkSignInAction } from '#lib/server/actions/email-sign-in.js';
import { previewLink } from '#lib/server/use-cases/email-sign-in.js';
import type { Actions, PageServerLoad } from './$types';

// Opening the link only shows a button: mail scanners that open links must not use it up.
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token, link: token ? await previewLink(env.DB, token) : null };
};

export const actions = { default: linkSignInAction(env) } satisfies Actions;
