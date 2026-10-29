import type { Cookies } from '@sveltejs/kit';
import { nextPath, normalizeDisplayName } from '#lib/domain/account.js';
import type { UserRow } from '../db/types.js';
import type { GoogleAttempt } from '../use-cases/google-sign-in.js';
import type { SignInIntent, SignInOutcome } from '../use-cases/sign-in.js';
import { getSignedInUser, signIn } from './session.js';

const ATTEMPT_COOKIE = 'sign_in_attempt';
const ERROR_COOKIE = 'sign_in_error';
const ATTEMPT_SECONDS = 10 * 60;

export type IntentKind = SignInIntent['kind'];

/**
 * What the browser carries from the start of a sign-in to its finish: the intent, where to go
 * afterwards, and the Google state or the passkey challenge.
 */
export interface SignInAttempt {
	intent: IntentKind;
	displayName: string;
	next: string;
	google?: GoogleAttempt;
	challenge?: string;
}

/** Stores a new attempt. Adding a method returns to My games; anything else to the checked next. */
export function saveAttempt(
	cookies: Cookies,
	intent: IntentKind,
	fields: { displayName: string; next: unknown } & Pick<SignInAttempt, 'google' | 'challenge'>
): void {
	const attempt: SignInAttempt = {
		...fields,
		intent,
		next:
			intent === 'link' ? '/games' : nextPath(typeof fields.next === 'string' ? fields.next : null)
	};
	cookies.set(ATTEMPT_COOKIE, JSON.stringify(attempt), {
		path: '/',
		httpOnly: true,
		// Lax, so the cookie comes back on the top-level redirect from Google.
		sameSite: 'lax',
		maxAge: ATTEMPT_SECONDS
	});
}

/** The attempt in the cookie, removed so it is used once. Null when missing or malformed. */
export function takeAttempt(cookies: Cookies): SignInAttempt | null {
	const value = cookies.get(ATTEMPT_COOKIE);
	cookies.delete(ATTEMPT_COOKIE, { path: '/' });
	return value ? parseAttempt(value) : null;
}

/** The stored attempt with its intent resolved against who is signed in now, or null. */
export async function takeResolvedAttempt(
	cookies: Cookies
): Promise<{ attempt: SignInAttempt; intent: SignInIntent } | null> {
	const attempt = takeAttempt(cookies);
	const intent = attempt && resolveIntent(attempt, await getSignedInUser(cookies));
	return attempt && intent ? { attempt, intent } : null;
}

/** Starts the session a finished sign-in or sign-up earned. Adding a method keeps the current one. */
export async function applyOutcome(cookies: Cookies, outcome: SignInOutcome): Promise<void> {
	if (outcome.kind === 'signed-in') await signIn(cookies, outcome.userId);
}

export function parseAttempt(value: string): SignInAttempt | null {
	let data: unknown;
	try {
		data = JSON.parse(value);
	} catch {
		return null;
	}
	if (typeof data !== 'object' || data === null) return null;
	const { intent, displayName, next, google, challenge } = data as Record<string, unknown>;
	if (intent !== 'sign-in' && intent !== 'sign-up' && intent !== 'link') return null;
	if (typeof displayName !== 'string' || typeof next !== 'string') return null;
	if (challenge !== undefined && typeof challenge !== 'string') return null;
	if (google !== undefined && !isGoogleAttempt(google)) return null;
	return { intent, displayName, next: nextPath(next), google, challenge };
}

/** Turns the stored intent into what the use cases apply. Null when it no longer holds. */
export function resolveIntent(attempt: SignInAttempt, user: UserRow | null): SignInIntent | null {
	switch (attempt.intent) {
		case 'sign-in':
			return { kind: 'sign-in' };
		case 'sign-up': {
			const displayName = normalizeDisplayName(attempt.displayName);
			return displayName ? { kind: 'sign-up', displayName } : null;
		}
		case 'link':
			return user ? { kind: 'link', userId: user.id } : null;
	}
}

/** Carries an error to the sign-in page across a redirect. */
export function flashError(cookies: Cookies, message: string): void {
	cookies.set(ERROR_COOKIE, message, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 });
}

export function takeFlashError(cookies: Cookies): string | null {
	const message = cookies.get(ERROR_COOKIE) ?? null;
	if (message) cookies.delete(ERROR_COOKIE, { path: '/' });
	return message;
}

function isGoogleAttempt(value: unknown): value is GoogleAttempt {
	if (typeof value !== 'object' || value === null) return false;
	const { state, codeVerifier } = value as Record<string, unknown>;
	return typeof state === 'string' && typeof codeVerifier === 'string';
}
