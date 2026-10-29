import type { SessionRow, UserRow } from './types.js';

export interface SessionWithUser {
	session: SessionRow;
	user: UserRow;
}

export async function insertSession(db: D1Database, session: SessionRow): Promise<void> {
	await db
		.prepare('INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)')
		.bind(session.id, session.user_id, session.expires_at)
		.run();
}

export async function getSessionWithUser(
	db: D1Database,
	id: string
): Promise<SessionWithUser | null> {
	const row = await db
		.prepare(
			`SELECT session.expires_at, user.*
			FROM session JOIN user ON user.id = session.user_id
			WHERE session.id = ?`
		)
		.bind(id)
		.first<UserRow & Pick<SessionRow, 'expires_at'>>();
	if (!row) return null;
	const { expires_at, ...user } = row;
	return { session: { id, user_id: user.id, expires_at }, user };
}

export async function extendSession(db: D1Database, id: string, expiresAt: string): Promise<void> {
	await db.prepare('UPDATE session SET expires_at = ? WHERE id = ?').bind(expiresAt, id).run();
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM session WHERE id = ?').bind(id).run();
}

/** Clears a user's expired sessions. Called on sign-in, so the table does not grow without bound. */
export async function deleteExpiredSessions(
	db: D1Database,
	userId: number,
	now: string
): Promise<void> {
	await db
		.prepare('DELETE FROM session WHERE user_id = ? AND expires_at <= ?')
		.bind(userId, now)
		.run();
}
