import { normalizeDisplayName } from '#lib/domain/account.js';
import { createUserWithIdentity, findIdentity } from '../db/users.js';

/**
 * The rehearsal's sign-in: one account per name, no credential. Only the dev server's
 * /dev/sign-in route calls it, and that route is not in production builds.
 */
export async function testSignIn(db: D1Database, name: string): Promise<number | null> {
	const displayName = normalizeDisplayName(name);
	if (!displayName) return null;
	const existing = await findIdentity(db, 'test', displayName);
	if (existing) return existing.user_id;
	const user = await createUserWithIdentity(db, displayName, {
		provider: 'test',
		subject: displayName
	});
	return user.id;
}
