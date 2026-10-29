import { beforeEach, describe, expect, it } from 'vitest';
import {
	countRequestsSince,
	deleteExpiredRequests,
	findRequest,
	findRequestByToken,
	insertSignInRequest,
	spendCodeAttempt,
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

beforeEach(async () => {
	db = createTestDb();
	await insertSignInRequest(db, request);
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

describe('spendCodeAttempt', () => {
	it('counts attempts up to the limit, then refuses', async () => {
		expect(await spendCodeAttempt(db, 'request-1', 2, NOW)).toMatchObject({ code_attempts: 1 });
		expect(await spendCodeAttempt(db, 'request-1', 2, NOW)).toMatchObject({ code_attempts: 2 });
		expect(await spendCodeAttempt(db, 'request-1', 2, NOW)).toBeNull();
	});

	it('refuses an expired request', async () => {
		expect(await spendCodeAttempt(db, 'request-1', 5, request.expires_at)).toBeNull();
	});
});

describe('countRequestsSince and deleteExpiredRequests', () => {
	it('count an email’s recent requests and clear expired ones', async () => {
		await insertSignInRequest(db, {
			...request,
			id: 'request-0',
			token_hash: 'token-hash-0',
			created_at: '2029-12-31T23:00:00.000Z',
			expires_at: '2029-12-31T23:15:00.000Z'
		});

		expect(await countRequestsSince(db, 'sam@example.com', '2029-12-31T23:50:00.000Z')).toBe(1);
		expect(await countRequestsSince(db, 'sam@example.com', '2029-12-31T22:00:00.000Z')).toBe(2);

		await deleteExpiredRequests(db, NOW);
		expect(await countRequestsSince(db, 'sam@example.com', '2029-12-31T22:00:00.000Z')).toBe(1);
	});
});
