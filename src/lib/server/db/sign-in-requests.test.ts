import { beforeEach, describe, expect, it } from 'vitest';
import {
	checkCode,
	deleteExpiredRequests,
	findRequest,
	findRequestByToken,
	insertSignInRequest,
	takeRequest
} from './sign-in-requests.js';
import { createTestDb } from './testing/test-db.js';
import type { SignInRequestRow } from './types.js';

let db: D1Database;

const NOW = '2030-01-01T00:00:00.000Z';
const request = {
	id: 'request-1',
	token_hash: 'token-hash-1',
	code_hash: 'code-hash-1',
	email: 'sam@example.com',
	next_path: '/new',
	expires_at: '2030-01-01T00:15:00.000Z',
	created_at: NOW
} satisfies Omit<SignInRequestRow, 'code_attempts'>;

const NO_LIMIT = { since: NOW, max: 99 };

beforeEach(async () => {
	db = createTestDb();
	await insertSignInRequest(db, request, NO_LIMIT);
});

describe('findRequest and findRequestByToken', () => {
	it('find a request by its id or its token until it expires', async () => {
		expect(await findRequest(db, 'request-1', NOW)).toMatchObject({ ...request, code_attempts: 0 });
		expect(await findRequestByToken(db, 'token-hash-1', NOW)).toMatchObject({ id: 'request-1' });

		expect(await findRequest(db, 'request-1', request.expires_at)).toBeNull();
		expect(await findRequestByToken(db, 'token-hash-1', request.expires_at)).toBeNull();
	});
});

describe('takeRequest', () => {
	it('deletes the request once, so a second use finds nothing', async () => {
		expect(await takeRequest(db, 'request-1')).toBe(true);
		expect(await takeRequest(db, 'request-1')).toBe(false);
		expect(await findRequest(db, 'request-1', NOW)).toBeNull();
	});
});

describe('checkCode', () => {
	it('counts wrong codes up to the limit, then refuses even the right one', async () => {
		expect(await checkCode(db, 'request-1', 'wrong', 2, NOW)).toMatchObject({ code_attempts: 1 });
		expect(await checkCode(db, 'request-1', 'wrong', 2, NOW)).toMatchObject({ code_attempts: 2 });
		expect(await checkCode(db, 'request-1', 'code-hash-1', 2, NOW)).toBeNull();
	});

	it('spends nothing on the right code', async () => {
		for (let i = 0; i < 2; i++) {
			expect(await checkCode(db, 'request-1', 'code-hash-1', 1, NOW)).toMatchObject({
				code_attempts: 0
			});
		}
	});

	it('refuses an expired request', async () => {
		expect(await checkCode(db, 'request-1', 'code-hash-1', 5, request.expires_at)).toBeNull();
	});
});

describe('insertSignInRequest', () => {
	it('refuses a request once the address has the most allowed since a time', async () => {
		const another = (id: string) => ({ ...request, id, token_hash: `hash-${id}` });
		const limit = { since: '2029-12-31T23:50:00.000Z', max: 2 };

		expect(await insertSignInRequest(db, another('request-2'), limit)).toBe(true);
		expect(await insertSignInRequest(db, another('request-3'), limit)).toBe(false);
		expect(
			await insertSignInRequest(db, { ...another('other'), email: 'alex@example.com' }, limit)
		).toBe(true);
		expect(await findRequest(db, 'request-3', NOW)).toBeNull();
	});
});

describe('deleteExpiredRequests', () => {
	it('clears only expired requests', async () => {
		await insertSignInRequest(
			db,
			{
				...request,
				id: 'request-0',
				token_hash: 'token-hash-0',
				created_at: '2029-12-31T23:00:00.000Z',
				expires_at: '2029-12-31T23:15:00.000Z'
			},
			NO_LIMIT
		);

		await deleteExpiredRequests(db, NOW);

		const { results } = await db.prepare('SELECT id FROM sign_in_request').all();
		expect(results).toEqual([{ id: 'request-1' }]);
	});
});
