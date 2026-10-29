import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { error, redirect } from '@sveltejs/kit';
import { nextPath } from '#lib/domain/account.js';
import { signIn } from '#lib/server/http/session.js';
import { testSignIn } from '#lib/server/use-cases/test-sign-in.js';
import type { RequestHandler } from './$types';

/**
 * The rehearsal's sign-in: /dev/sign-in?name=<name>&next=<path>. `dev` is false in every
 * production build, so no setting can turn this on in a deployment.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!dev) error(404, 'Not found');
	const userId = await testSignIn(env.DB, url.searchParams.get('name') ?? '');
	if (userId === null) error(400, 'Pass ?name=');
	await signIn(cookies, userId);
	redirect(303, nextPath(url.searchParams.get('next')));
};
