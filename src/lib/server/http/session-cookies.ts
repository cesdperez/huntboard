import { redirect, type Cookies } from '@sveltejs/kit';
import { signInPath } from '#lib/domain/account.js';
import type { UserRow } from '../db/types.js';
import { endSession, startSession, validateSession } from '../use-cases/sessions.js';

const SESSION_COOKIE = 'session';

/** The signed-in user, or null. Renews the cookie when the session was renewed. */
export async function getSignedInUser(db: D1Database, cookies: Cookies): Promise<UserRow | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const valid = await validateSession(db, token);
	if (!valid) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return null;
	}
	if (valid.renewedUntil) setSessionCookie(cookies, token, valid.renewedUntil);
	return valid.user;
}

/** The signed-in user. Without one, redirects to sign-in and back to this page afterwards. */
export async function requireUser(
	db: D1Database,
	{ cookies, url }: { cookies: Cookies; url: URL }
): Promise<UserRow> {
	const user = await getSignedInUser(db, cookies);
	if (!user) redirect(303, signInPath(url.pathname + url.search));
	return user;
}

export async function signIn(db: D1Database, cookies: Cookies, userId: number): Promise<void> {
	const { token, expiresAt } = await startSession(db, userId);
	setSessionCookie(cookies, token, expiresAt);
}

export async function signOut(db: D1Database, cookies: Cookies): Promise<void> {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await endSession(db, token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

function setSessionCookie(cookies: Cookies, token: string, expires: Date) {
	// SvelteKit adds Secure everywhere except http://localhost. Lax keeps the session when someone
	// follows a link to the site, such as an admin link or the sign-in email.
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires });
}
