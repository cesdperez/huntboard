import { generateToken, sha256Base64Url } from '#lib/domain/token.js';
import {
	deleteExpiredSessions,
	deleteSession,
	extendSession,
	getSessionWithUser,
	insertSession
} from '../db/sessions.js';
import type { UserRow } from '../db/types.js';

export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Renewing at most once per half lifetime keeps session writes rare.
const RENEW_WHEN_DAYS_LEFT = SESSION_DAYS / 2;

export interface StartedSession {
	/** Goes in the cookie. Only its hash is stored. */
	token: string;
	expiresAt: Date;
}

export interface ValidSession {
	user: UserRow;
	/** The new expiry when this request renewed the session, so the cookie can follow. */
	renewedUntil: Date | null;
}

export async function startSession(
	db: D1Database,
	userId: number,
	now = new Date()
): Promise<StartedSession> {
	const token = generateToken();
	const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
	await deleteExpiredSessions(db, userId, now.toISOString());
	await insertSession(db, {
		id: await sha256Base64Url(token),
		user_id: userId,
		expires_at: expiresAt.toISOString()
	});
	return { token, expiresAt };
}

/** The signed-in user for a cookie token, or null when the session is unknown or expired. */
export async function validateSession(
	db: D1Database,
	token: string,
	now = new Date()
): Promise<ValidSession | null> {
	const id = await sha256Base64Url(token);
	const found = await getSessionWithUser(db, id);
	if (!found) return null;

	const expiresAt = new Date(found.session.expires_at);
	if (expiresAt <= now) {
		await deleteSession(db, id);
		return null;
	}
	if (expiresAt.getTime() - now.getTime() > RENEW_WHEN_DAYS_LEFT * DAY_MS) {
		return { user: found.user, renewedUntil: null };
	}
	const renewedUntil = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
	await extendSession(db, id, renewedUntil.toISOString());
	return { user: found.user, renewedUntil };
}

export async function endSession(db: D1Database, token: string): Promise<void> {
	await deleteSession(db, await sha256Base64Url(token));
}
