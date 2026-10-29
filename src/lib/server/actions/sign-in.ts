import { fail, redirect, type Action } from '@sveltejs/kit';
import { nextPath, normalizeDisplayName } from '#lib/domain/account.js';
import { googleClient } from '../http/google.js';
import { getSignedInUser } from '../http/session.js';
import { saveAttempt, type IntentKind } from '../http/sign-in-attempt.js';
import { startGoogleSignIn } from '../use-cases/google-sign-in.js';
import { readString } from '../use-cases/form.js';

/** What /login shows again after a refused form. */
export interface SignInFormResult {
	displayName: string;
	error: string;
}

export const NAME_ERROR = 'Type the name to show on your account.';

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
	saveAttempt(cookies, {
		intent,
		displayName,
		next: intent === 'link' ? '/games' : nextPath(url.searchParams.get('next')),
		google: attempt
	});
	redirect(303, authorizationUrl.href);
};

export function readIntent(value: unknown): IntentKind {
	return value === 'sign-up' || value === 'link' ? value : 'sign-in';
}
