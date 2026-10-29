import { decodeIdToken, generateCodeVerifier, generateState, type OAuth2Tokens } from 'arctic';
import { applySignIn, type SignInIntent, type SignInOutcome } from './sign-in.js';

// Only these basic scopes, so the OAuth app needs no Google verification.
const SCOPES = ['openid', 'email', 'profile'];

export const NO_GOOGLE_ACCOUNT_MESSAGE =
	'No Huntboard account uses that Google account. Create an account first.';
const FAILED_MESSAGE = 'Google sign-in did not finish. Try again.';

/** The part of arctic's Google client this module uses, so tests can stand in for Google. */
export interface GoogleClient {
	createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL;
	validateAuthorizationCode(code: string, codeVerifier: string): Promise<OAuth2Tokens>;
}

/** What the browser keeps in a cookie between the redirect to Google and the callback. */
export interface GoogleAttempt {
	state: string;
	codeVerifier: string;
}

export function startGoogleSignIn(google: GoogleClient): { url: URL; attempt: GoogleAttempt } {
	const attempt = { state: generateState(), codeVerifier: generateCodeVerifier() };
	const url = google.createAuthorizationURL(attempt.state, attempt.codeVerifier, SCOPES);
	// Lets someone with several Google accounts pick the one to add or sign in with.
	url.searchParams.set('prompt', 'select_account');
	return { url, attempt };
}

/** Checks the callback against the attempt, exchanges the code, and applies the intent. */
export async function finishGoogleSignIn(
	db: D1Database,
	google: GoogleClient,
	callback: URLSearchParams,
	attempt: GoogleAttempt | null,
	intent: SignInIntent
): Promise<SignInOutcome> {
	const code = callback.get('code');
	if (!attempt || !code || callback.get('state') !== attempt.state) {
		return { kind: 'error', message: FAILED_MESSAGE };
	}

	let claims: Record<string, unknown>;
	try {
		const tokens = await google.validateAuthorizationCode(code, attempt.codeVerifier);
		// The token came straight from Google over TLS, so its signature needs no check here.
		claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
	} catch {
		return { kind: 'error', message: FAILED_MESSAGE };
	}
	if (typeof claims.sub !== 'string' || !claims.sub) {
		return { kind: 'error', message: FAILED_MESSAGE };
	}

	const label = typeof claims.email === 'string' ? claims.email : '';
	return applySignIn(
		db,
		{ provider: 'google', subject: claims.sub, label },
		intent,
		NO_GOOGLE_ACCOUNT_MESSAGE
	);
}
