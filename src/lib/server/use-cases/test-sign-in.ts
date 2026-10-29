import { normalizeDisplayName } from '#lib/domain/account.js';
import { findOrCreateUser } from '../db/users.js';

/**
 * The rehearsal's sign-in: one account per name, no email. Only the dev server's /dev/sign-in
 * route calls it, and that route is not in production builds.
 */
export async function testSignIn(db: D1Database, name: string): Promise<number | null> {
	const displayName = normalizeDisplayName(name);
	if (!displayName) return null;
	// .invalid never resolves, so no real inbox can sign in to a test account.
	const email = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@test.invalid`;
	return (await findOrCreateUser(db, email, displayName)).id;
}
