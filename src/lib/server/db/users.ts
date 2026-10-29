import type { IdentityProvider, IdentityRow, UserRow } from './types.js';

/** What a new identity row stores. Passkeys also carry their key and counter. */
export type NewIdentity = Pick<IdentityRow, 'provider' | 'subject'> &
	Partial<Pick<IdentityRow, 'label' | 'public_key' | 'sign_count' | 'transports'>>;

/** Creates the user and its first identity in one batch. Throws when the identity is taken. */
export async function createUserWithIdentity(
	db: D1Database,
	displayName: string,
	identity: NewIdentity
): Promise<UserRow> {
	const [created] = await db.batch<UserRow>([
		db.prepare('INSERT INTO user (display_name) VALUES (?) RETURNING *').bind(displayName),
		insertIdentity(db, 'last_insert_rowid()', identity)
	]);
	const user = created.results[0];
	if (!user) throw new Error('Inserting a user returned no row');
	return user;
}

/** Adds a sign-in method to a user. False when another user, or this one, already has it. */
export async function addIdentity(
	db: D1Database,
	userId: number,
	identity: NewIdentity
): Promise<boolean> {
	const result = await insertIdentity(db, '?', identity, userId).run();
	return result.meta.changes > 0;
}

export function findIdentity(
	db: D1Database,
	provider: IdentityProvider,
	subject: string
): Promise<IdentityRow | null> {
	return db
		.prepare('SELECT * FROM identity WHERE provider = ? AND subject = ?')
		.bind(provider, subject)
		.first<IdentityRow>();
}

export async function listIdentities(db: D1Database, userId: number): Promise<IdentityRow[]> {
	const { results } = await db
		.prepare('SELECT * FROM identity WHERE user_id = ? ORDER BY id')
		.bind(userId)
		.all<IdentityRow>();
	return results;
}

export async function updatePasskeySignCount(
	db: D1Database,
	identityId: number,
	signCount: number
): Promise<void> {
	await db
		.prepare('UPDATE identity SET sign_count = ? WHERE id = ?')
		.bind(signCount, identityId)
		.run();
}

function insertIdentity(
	db: D1Database,
	userIdSql: '?' | 'last_insert_rowid()',
	identity: NewIdentity,
	...userId: number[]
) {
	// ON CONFLICT DO NOTHING lets addIdentity report a taken identity without a thrown error.
	const conflict = userIdSql === '?' ? 'ON CONFLICT (provider, subject) DO NOTHING' : '';
	return db
		.prepare(
			`INSERT INTO identity (user_id, provider, subject, label, public_key, sign_count, transports)
			VALUES (${userIdSql}, ?, ?, ?, ?, ?, ?) ${conflict}`
		)
		.bind(
			...userId,
			identity.provider,
			identity.subject,
			identity.label ?? '',
			identity.public_key ?? null,
			identity.sign_count ?? null,
			identity.transports ?? null
		);
}
