import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { findOrCreateUser, findUserByEmail } from '../db/users.js';
import {
	MAX_CODE_ATTEMPTS,
	MAX_REQUESTS_PER_WINDOW,
	finishWithCode,
	finishWithLink,
	pendingRequestEmail,
	previewLink,
	requestSignIn,
	type SendEmail
} from './email-sign-in.js';

let db: D1Database;
let send: ReturnType<typeof vi.fn<SendEmail>>;

const NOW = new Date('2030-01-01T00:00:00.000Z');
const LATER = new Date('2030-01-01T00:16:00.000Z');
const ORIGIN = 'https://huntboard.example';

beforeEach(() => {
	db = createTestDb();
	send = vi.fn<SendEmail>().mockResolvedValue(true);
});

async function sent(email = 'sam@example.com', next: string | null = '/new') {
	const result = await requestSignIn(db, send, { email, next, origin: ORIGIN }, NOW);
	if (result.kind !== 'sent') throw new Error(`Expected a sent email, got ${result.message}`);
	return { ...result, token: new URL(result.link).searchParams.get('token') ?? '' };
}

describe('requestSignIn', () => {
	it('emails a link and a code to the normalised address', async () => {
		const { link, code, email } = await sent(' Sam@Example.com ');

		expect(email).toBe('sam@example.com');
		expect(link).toMatch(/^https:\/\/huntboard\.example\/login\/verify\?token=[\w-]{22}$/);
		expect(code).toMatch(/^\d{6}$/);
		expect(send).toHaveBeenCalledWith({
			to: 'sam@example.com',
			subject: 'Sign in to Huntboard',
			text: expect.stringContaining(link)
		});
		expect(send.mock.calls[0][0].text).toContain(code);
	});

	it('refuses an address that is not an email, and sends nothing', async () => {
		const result = await requestSignIn(db, send, { email: 'sam', next: null, origin: ORIGIN }, NOW);

		expect(result).toMatchObject({ kind: 'error', status: 400 });
		expect(send).not.toHaveBeenCalled();
	});

	it('limits how many emails one address gets in a window', async () => {
		for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) await sent();

		const result = await requestSignIn(
			db,
			send,
			{ email: 'sam@example.com', next: null, origin: ORIGIN },
			NOW
		);
		expect(result).toMatchObject({ kind: 'error', status: 429 });
		expect(send).toHaveBeenCalledTimes(MAX_REQUESTS_PER_WINDOW);
	});

	it('drops the request when the email cannot be sent', async () => {
		send.mockResolvedValue(false);
		const result = await requestSignIn(
			db,
			send,
			{ email: 'sam@example.com', next: null, origin: ORIGIN },
			NOW
		);

		expect(result).toMatchObject({ kind: 'error', status: 502 });
		const { results } = await db.prepare('SELECT id FROM sign_in_request').all();
		expect(results).toEqual([]);
	});
});

describe('finishWithLink', () => {
	it('signs an existing user in once, and goes to the checked next path', async () => {
		const sam = await findOrCreateUser(db, 'sam@example.com', 'Sam');
		const { token } = await sent();

		expect(await previewLink(db, token, NOW)).toEqual({ email: 'sam@example.com', isNew: false });
		expect(await finishWithLink(db, token, '', NOW)).toEqual({
			kind: 'signed-in',
			userId: sam.id,
			next: '/new'
		});
		expect(await finishWithLink(db, token, '', NOW)).toMatchObject({ kind: 'error' });
	});

	it('asks a new address for a name before creating the account', async () => {
		const { token } = await sent('new@example.com', 'https://evil.example/');

		expect(await previewLink(db, token, NOW)).toEqual({ email: 'new@example.com', isNew: true });
		expect(await finishWithLink(db, token, '  ', NOW)).toEqual({
			kind: 'needs-name',
			email: 'new@example.com'
		});

		const result = await finishWithLink(db, token, 'New Organiser', NOW);
		const user = await findUserByEmail(db, 'new@example.com');
		expect(user).toMatchObject({ display_name: 'New Organiser' });
		expect(result).toEqual({ kind: 'signed-in', userId: user?.id, next: '/games' });
	});

	it('refuses an expired or unknown link', async () => {
		const { token } = await sent();

		expect(await previewLink(db, token, LATER)).toBeNull();
		expect(await finishWithLink(db, token, 'Sam', LATER)).toMatchObject({ kind: 'error' });
		expect(await finishWithLink(db, 'not-a-token', 'Sam', NOW)).toMatchObject({ kind: 'error' });
	});
});

describe('finishWithCode', () => {
	it('signs in with the code from the same request, once', async () => {
		const sam = await findOrCreateUser(db, 'sam@example.com', 'Sam');
		const { requestId, code } = await sent();

		expect(
			await finishWithCode(db, requestId, ` ${code.slice(0, 3)} ${code.slice(3)} `, '', NOW)
		).toEqual({ kind: 'signed-in', userId: sam.id, next: '/new' });
		expect(await finishWithCode(db, requestId, code, '', NOW)).toMatchObject({ kind: 'error' });
	});

	it('asks a new address for a name after the right code', async () => {
		const { requestId, code } = await sent('new@example.com');

		expect(await finishWithCode(db, requestId, code, '', NOW)).toEqual({
			kind: 'needs-name',
			email: 'new@example.com'
		});
		expect(await finishWithCode(db, requestId, code, 'New Organiser', NOW)).toMatchObject({
			kind: 'signed-in'
		});
	});

	it('stops accepting codes after too many wrong ones', async () => {
		const { requestId, code } = await sent();
		const wrong = code === '000000' ? '111111' : '000000';

		for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
			expect(await finishWithCode(db, requestId, wrong, '', NOW)).toEqual({
				kind: 'error',
				message: 'That code is not right. Check the email and try again.'
			});
		}
		expect(await finishWithCode(db, requestId, code, '', NOW)).toMatchObject({
			kind: 'error',
			message: expect.stringContaining('Ask for a new email')
		});
	});

	it('stops offering the code form once the codes run out', async () => {
		const { requestId, code } = await sent();
		const wrong = code === '000000' ? '111111' : '000000';
		expect(await pendingRequestEmail(db, requestId, NOW)).toBe('sam@example.com');

		for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) await finishWithCode(db, requestId, wrong, '', NOW);

		expect(await pendingRequestEmail(db, requestId, NOW)).toBeNull();
	});

	it('refuses a code from another request', async () => {
		await findOrCreateUser(db, 'sam@example.com', 'Sam');
		const { requestId, code } = await sent();
		const other = await sent();

		expect(await finishWithCode(db, other.requestId, other.code, '', NOW)).toMatchObject({
			kind: 'signed-in'
		});
		expect(await finishWithCode(db, other.requestId, code, '', NOW)).toMatchObject({
			kind: 'error'
		});
		expect(await finishWithCode(db, requestId, code, '', NOW)).toMatchObject({
			kind: 'signed-in'
		});
		expect(await finishWithCode(db, 'unknown', code, '', NOW)).toMatchObject({ kind: 'error' });
	});
});
