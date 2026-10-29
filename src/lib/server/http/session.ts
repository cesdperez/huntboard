import { env } from 'cloudflare:workers';
import { redirect, type Cookies } from '@sveltejs/kit';
import type { UserRow } from '../db/types.js';
import { endSession, startSession, validateSession } from '../use-cases/sessions.js';

const SESSION_COOKIE = 'session';

/** The signed-in user, or null. Renews the cookie when the session was renewed. */
export async function getSignedInUser(cookies: Cookies): Promise<UserRow | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const valid = await validateSession(env.DB, token);
	if (!valid) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return null;
	}
	if (valid.renewedUntil) setSessionCookie(cookies, token, valid.renewedUntil);
	return valid.user;
}

/** The signed-in user. Without one, redirects to sign-in and back to this page afterwards. */
export async function requireUser({ cookies, url }: { cookies: Cookies; url: URL }) {
	const user = await getSignedInUser(cookies);
	if (!user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return user;
}

export async function signIn(cookies: Cookies, userId: number): Promise<void> {
	const { token, expiresAt } = await startSession(env.DB, userId);
	setSessionCookie(cookies, token, expiresAt);
}

export async function signOut(cookies: Cookies): Promise<void> {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await endSession(env.DB, token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

function setSessionCookie(cookies: Cookies, token: string, expires: Date) {
	// SvelteKit adds Secure everywhere except http://localhost. Lax keeps it on the redirect back from Google.
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires });
}
