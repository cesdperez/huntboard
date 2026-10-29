import { fail, redirect, type Action, type RequestHandler } from '@sveltejs/kit';
import { normalizeDisplayName } from '#lib/domain/account.js';
import { googleClient } from '../http/google.js';
import { getSignedInUser } from '../http/session.js';
import {
	applyOutcome,
	flashError,
	saveAttempt,
	takeResolvedAttempt,
	type IntentKind
} from '../http/sign-in-attempt.js';
import { finishGoogleSignIn, startGoogleSignIn } from '../use-cases/google-sign-in.js';
import { readString } from '../use-cases/form.js';

/** What /login shows again after a refused form. */
export interface SignInFormResult {
	displayName: string;
	error: string;
}

export const NAME_ERROR = 'Type the name to show on your account.';
const GOOGLE_ORIGIN = 'https://accounts.google.com';
const EXPIRED_MESSAGE = 'That sign-in took too long or was already used. Try again.';

/** Redirects to Google to sign in, sign up, or add Google to the signed-in account. */
export const googleAction: Action = async ({ request, cookies, url }) => {
	const data = await request.formData();
	const intent = readIntent(readString(data, 'intent'));
	const displayName = readString(data, 'displayName');
	const google = googleClient(url);
	if (!google) {
		return fail(503, { displayName, error: 'Google sign-in is not set up here.' });
	}
	if (intent === 'sign-up' && !normalizeDisplayName(displayName)) {
		return fail(400, { displayName, error: NAME_ERROR });
	}
	if (intent === 'link' && !(await getSignedInUser(cookies))) {
		redirect(303, '/login');
	}

	const { url: authorizationUrl, attempt } = startGoogleSignIn(google);
	saveAttempt(cookies, intent, {
		displayName,
		next: url.searchParams.get('next'),
		google: attempt
	});
	redirect(303, authorizationUrl.href, { external: [GOOGLE_ORIGIN] });
};

/** Where Google sends the browser back to. Errors show on the page the attempt started from. */
export const googleCallback =
	(env: Pick<Cloudflare.Env, 'DB'>): RequestHandler =>
	async ({ cookies, url }) => {
		const resolved = await takeResolvedAttempt(cookies);
		const google = googleClient(url);
		if (!resolved || !google) {
			flashError(cookies, EXPIRED_MESSAGE);
			redirect(303, '/login');
		}

		const { attempt, intent } = resolved;
		const outcome = await finishGoogleSignIn(
			env.DB,
			google,
			url.searchParams,
			attempt.google ?? null,
			intent
		);
		if (outcome.kind === 'error') {
			flashError(cookies, outcome.message);
			redirect(303, intent.kind === 'link' ? '/games' : '/login');
		}
		await applyOutcome(cookies, outcome);
		redirect(303, attempt.next);
	};

export function readIntent(value: unknown): IntentKind {
	return value === 'sign-up' || value === 'link' ? value : 'sign-in';
}
