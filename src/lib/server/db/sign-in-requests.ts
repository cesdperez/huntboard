import type { SignInRequestRow } from './types.js';

export async function insertSignInRequest(
	db: D1Database,
	request: Omit<SignInRequestRow, 'code_attempts'>
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO sign_in_request (id, token_hash, code_hash, email, next_path, expires_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			request.id,
			request.token_hash,
			request.code_hash,
			request.email,
			request.next_path,
			request.expires_at,
			request.created_at
		)
		.run();
}

export function findRequest(
	db: D1Database,
	id: string,
	now: string
): Promise<SignInRequestRow | null> {
	return db
		.prepare('SELECT * FROM sign_in_request WHERE id = ? AND expires_at > ?')
		.bind(id, now)
		.first<SignInRequestRow>();
}

export function findRequestByToken(
	db: D1Database,
	tokenHash: string,
	now: string
): Promise<SignInRequestRow | null> {
	return db
		.prepare('SELECT * FROM sign_in_request WHERE token_hash = ? AND expires_at > ?')
		.bind(tokenHash, now)
		.first<SignInRequestRow>();
}

/** Deletes the request. False when it was already gone, so only one sign-in can use it. */
export async function takeRequest(db: D1Database, id: string): Promise<boolean> {
	const taken = await db
		.prepare('DELETE FROM sign_in_request WHERE id = ? RETURNING id')
		.bind(id)
		.first();
	return taken !== null;
}

/**
 * Counts one code attempt before the code is checked, so parallel guesses each spend one.
 * Null when the request is gone, expired, or out of attempts.
 */
export function spendCodeAttempt(
	db: D1Database,
	id: string,
	maxAttempts: number,
	now: string
): Promise<SignInRequestRow | null> {
	return db
		.prepare(
			`UPDATE sign_in_request SET code_attempts = code_attempts + 1
			WHERE id = ? AND code_attempts < ? AND expires_at > ? RETURNING *`
		)
		.bind(id, maxAttempts, now)
		.first<SignInRequestRow>();
}

export async function countRequestsSince(
	db: D1Database,
	email: string,
	since: string
): Promise<number> {
	const row = await db
		.prepare('SELECT COUNT(*) AS count FROM sign_in_request WHERE email = ? AND created_at > ?')
		.bind(email, since)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/** Clears requests nobody used. Called on each new request, so the table stays small. */
export async function deleteExpiredRequests(db: D1Database, now: string): Promise<void> {
	await db.prepare('DELETE FROM sign_in_request WHERE expires_at <= ?').bind(now).run();
}
