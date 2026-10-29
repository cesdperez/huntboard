import type { UserRow } from './types.js';

export function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
	return db.prepare('SELECT * FROM user WHERE email = ?').bind(email).first<UserRow>();
}

/** The user with this lowercase email, created with the name when there is none. */
export async function findOrCreateUser(
	db: D1Database,
	email: string,
	displayName: string
): Promise<UserRow> {
	// The no-op update makes RETURNING give back the existing row when two sign-ups race.
	const user = await db
		.prepare(
			`INSERT INTO user (email, display_name) VALUES (?, ?)
			ON CONFLICT (email) DO UPDATE SET email = excluded.email RETURNING *`
		)
		.bind(email, displayName)
		.first<UserRow>();
	if (!user) throw new Error('Inserting a user returned no row');
	return user;
}
