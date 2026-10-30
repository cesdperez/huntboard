import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import { signInEmail } from '#lib/server/email/sign-in-email.js';
import { SIGN_IN_MINUTES } from '#lib/server/use-cases/email-sign-in.js';
import type { RequestHandler } from './$types';

/** Previews the sign-in email's HTML, since the dev server sends none. */
export const GET: RequestHandler = ({ url }) => {
	if (!dev) error(404, 'Not found');
	const link = `${url.origin}/login/verify?token=preview`;
	const { html } = signInEmail('sam@example.com', link, '042917', SIGN_IN_MINUTES);
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};

// Without it, other methods answer 405 with `allow: GET`, which shows the route exists.
export const fallback: RequestHandler = () => error(404, 'Not found');
