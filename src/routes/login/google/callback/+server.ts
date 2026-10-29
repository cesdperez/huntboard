import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import { googleClient } from '#lib/server/http/google.js';
import { getSignedInUser, signIn } from '#lib/server/http/session.js';
import { flashError, resolveIntent, takeAttempt } from '#lib/server/http/sign-in-attempt.js';
import { finishGoogleSignIn } from '#lib/server/use-cases/google-sign-in.js';
import type { RequestHandler } from './$types';

const EXPIRED_MESSAGE = 'That sign-in took too long or was already used. Try again.';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const attempt = takeAttempt(cookies);
	const google = googleClient(url);
	const intent = attempt && resolveIntent(attempt, await getSignedInUser(cookies));
	if (!attempt || !google || !intent) return failed(EXPIRED_MESSAGE);

	const outcome = await finishGoogleSignIn(
		env.DB,
		google,
		url.searchParams,
		attempt.google ?? null,
		intent
	);
	if (outcome.kind === 'error') return failed(outcome.message, attempt.intent === 'link');
	if (outcome.kind === 'signed-in') await signIn(cookies, outcome.userId);
	redirect(303, attempt.next);

	function failed(message: string, toAccount = false): never {
		flashError(cookies, message);
		redirect(303, toAccount ? '/games' : '/login');
	}
};
