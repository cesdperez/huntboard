import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser } from '../db/users.js';
import { memoryCookies } from '../testing/memory-cookies.js';
import { getSignedInUser, requireUser, signIn, signOut } from './session-cookies.js';

let db: D1Database;
let userId: number;

beforeEach(async () => {
	db = createTestDb();
	userId = (await findOrCreateUser(db, 'sam@example.com', 'Sam')).id;
});

describe('session cookies', () => {
	it('sign in, read the user back, and sign out', async () => {
		const { cookies, jar } = memoryCookies();

		await signIn(db, cookies, userId);
		expect(jar.get('session')).toMatch(/^[\w-]{22}$/);
		expect(await getSignedInUser(db, cookies)).toMatchObject({ id: userId });

		await signOut(db, cookies);
		expect(jar.has('session')).toBe(false);
	});

	it('drops a cookie whose session is unknown', async () => {
		const { cookies, jar } = memoryCookies({ session: 'not-a-session' });

		expect(await getSignedInUser(db, cookies)).toBeNull();
		expect(jar.has('session')).toBe(false);
	});

	it('keeps a signed-out session dead even if the cookie comes back', async () => {
		const { cookies, jar } = memoryCookies();
		await signIn(db, cookies, userId);
		const token = jar.get('session') ?? '';
		await signOut(db, cookies);

		expect(await getSignedInUser(db, memoryCookies({ session: token }).cookies)).toBeNull();
	});
});

describe('requireUser', () => {
	it('sends a visitor to sign in and back to the page with its query', async () => {
		const url = new URL('https://huntboard.example/a/abc/setup?tab=links');

		await expect(requireUser(db, { cookies: memoryCookies().cookies, url })).rejects.toMatchObject({
			status: 303,
			location: '/login?next=%2Fa%2Fabc%2Fsetup%3Ftab%3Dlinks'
		});
	});

	it('returns the signed-in user', async () => {
		const { cookies } = memoryCookies();
		await signIn(db, cookies, userId);

		expect(
			await requireUser(db, { cookies, url: new URL('https://huntboard.example/new') })
		).toMatchObject({ id: userId });
	});
});
