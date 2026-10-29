import type { SignInRequestRow } from './types.js';

/**
 * Inserts the request unless its address already has `max` requests made after `since`.
 * One statement, so parallel requests cannot all pass the count.
 */
export async function insertSignInRequest(
	db: D1Database,
	request: Omit<SignInRequestRow, 'code_attempts'>,
	limit: { since: string; max: number }
): Promise<boolean> {
	const result = await db
		.prepare(
			`INSERT INTO sign_in_request (id, token_hash, code_hash, email, next_path, expires_at, created_at)
			SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
			WHERE (SELECT COUNT(*) FROM sign_in_request WHERE email = ?4 AND created_at > ?8) < ?9`
		)
		.bind(
			request.id,
			request.token_hash,
			request.code_hash,
			request.email,
			request.next_path,
			request.expires_at,
			request.created_at,
			limit.since,
			limit.max
		)
		.run();
	return result.meta.changes > 0;
}

/** The unexpired requests among `ids`, newest first. */
export async function findRequests(
	db: D1Database,
	ids: readonly string[],
	now: string
): Promise<SignInRequestRow[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM sign_in_request
			WHERE id IN (SELECT value FROM json_each(?)) AND expires_at > ?
			ORDER BY created_at DESC`
		)
		.bind(JSON.stringify(ids), now)
		.all<SignInRequestRow>();
	return results;
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
 * Compares the code and counts a wrong one in the same statement, so parallel guesses each spend
 * an attempt. The right code spends none. Null when the request is gone, expired, or out of attempts.
 */
export function checkCode(
	db: D1Database,
	id: string,
	codeHash: string,
	maxAttempts: number,
	now: string
): Promise<SignInRequestRow | null> {
	return db
		.prepare(
			`UPDATE sign_in_request SET code_attempts = code_attempts + (code_hash <> ?2)
			WHERE id = ?1 AND code_attempts < ?3 AND expires_at > ?4 RETURNING *`
		)
		.bind(id, codeHash, maxAttempts, now)
		.first<SignInRequestRow>();
}

/** Clears requests nobody used. Called on each new request, so the table stays small. */
export async function deleteExpiredRequests(db: D1Database, now: string): Promise<void> {
	await db.prepare('DELETE FROM sign_in_request WHERE expires_at <= ?').bind(now).run();
}
