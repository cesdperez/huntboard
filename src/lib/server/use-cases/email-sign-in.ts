import { nextPath, normalizeDisplayName, normalizeEmail } from '#lib/domain/account.js';
import { generateToken, sha256Base64Url } from '#lib/domain/token.js';
import { MS_PER_MINUTE } from '#lib/format/duration.js';
import {
	checkCode,
	deleteExpiredRequests,
	findRequestByToken,
	findRequests,
	insertSignInRequest,
	takeRequest
} from '../db/sign-in-requests.js';
import type { SignInRequestRow } from '../db/types.js';
import { findOrCreateUser, findUserByEmail } from '../db/users.js';

export interface SignInEmail {
	to: string;
	subject: string;
	text: string;
}

/** Sends one email. False when the provider refused it. */
export type SendEmail = (email: SignInEmail) => Promise<boolean>;

export const SIGN_IN_MINUTES = 15;
/** Unused requests per address and per SIGN_IN_MINUTES, so the form cannot flood an inbox. */
export const MAX_REQUESTS_PER_WINDOW = 3;
/** A six-digit code survives a few guesses, not many. */
export const MAX_CODE_ATTEMPTS = 5;

export type RequestResult =
	| {
			kind: 'sent';
			requestId: string;
			/** Every request whose code this browser can still use, newest first. */
			requestIds: string[];
			email: string;
			link: string;
			code: string;
	  }
	| { kind: 'error'; status: 400 | 429 | 502; message: string };

/** A user to sign in, a new address that still needs a name, or why the sign-in failed. */
export type FinishResult =
	| { kind: 'signed-in'; userId: number; next: string }
	| { kind: 'needs-name'; email: string }
	| { kind: 'error'; message: string; needsNewEmail: boolean };

const EXPIRED: FinishResult = {
	kind: 'error',
	message: 'This sign-in link or code has expired or was already used. Ask for a new email.',
	needsNewEmail: true
};

const TOO_MANY_WRONG_CODES: FinishResult = {
	kind: 'error',
	message: 'Too many wrong codes were tried, so the code no longer works. Ask for a new email.',
	needsNewEmail: true
};

const NOT_RIGHT: FinishResult = {
	kind: 'error',
	message: 'That code is not right. Check the email and try again.',
	needsNewEmail: false
};

/**
 * Emails a sign-in link and code. New and existing addresses get the same email, so the form does
 * not tell anyone which addresses have accounts.
 */
export async function requestSignIn(
	db: D1Database,
	send: SendEmail,
	input: {
		email: string;
		next: string | null;
		origin: string;
		/** Emails arrive late, so a code from an earlier email to the same address keeps working. */
		earlierRequestIds: readonly string[];
	},
	now = new Date()
): Promise<RequestResult> {
	const email = normalizeEmail(input.email);
	if (!email) {
		const message = input.email.trim()
			? 'This does not look like an email address. Type it like name@example.com.'
			: 'Type your email address.';
		return { kind: 'error', status: 400, message };
	}

	await deleteExpiredRequests(db, now.toISOString());
	const requestId = generateToken();
	const token = generateToken();
	const code = generateCode();
	const inserted = await insertSignInRequest(
		db,
		{
			id: requestId,
			token_hash: await sha256Base64Url(token),
			code_hash: await codeHash(requestId, code),
			email,
			next_path: nextPath(input.next),
			expires_at: new Date(now.getTime() + SIGN_IN_MINUTES * MS_PER_MINUTE).toISOString(),
			created_at: now.toISOString()
		},
		{
			since: new Date(now.getTime() - SIGN_IN_MINUTES * MS_PER_MINUTE).toISOString(),
			max: MAX_REQUESTS_PER_WINDOW
		}
	);
	if (!inserted) {
		return {
			kind: 'error',
			status: 429,
			message: 'We sent several emails to this address already. Wait a few minutes.'
		};
	}

	const link = `${input.origin}/login/verify?token=${token}`;
	if (!(await send(signInEmail(email, link, code)))) {
		await takeRequest(db, requestId);
		return { kind: 'error', status: 502, message: 'We could not send the email. Try again.' };
	}
	const earlier = await codeRequests(db, input.earlierRequestIds, now);
	const requestIds = [
		requestId,
		...earlier.filter((request) => request.email === email).map(({ id }) => id)
	].slice(0, MAX_REQUESTS_PER_WINDOW);
	return { kind: 'sent', requestId, requestIds, email, link, code };
}

/** The address the browser's requests are waiting on, while a code still works. */
export async function pendingRequestEmail(
	db: D1Database,
	requestIds: readonly string[],
	now = new Date()
): Promise<string | null> {
	const [newest] = await codeRequests(db, requestIds, now);
	return newest?.email ?? null;
}

async function codeRequests(db: D1Database, requestIds: readonly string[], now: Date) {
	const requests = await findRequests(
		db,
		requestIds.slice(0, MAX_REQUESTS_PER_WINDOW),
		now.toISOString()
	);
	return requests.filter((request) => request.code_attempts < MAX_CODE_ATTEMPTS);
}

/** What the link's page shows before anyone presses Sign in, or null for a dead link. */
export async function previewLink(
	db: D1Database,
	token: string,
	now = new Date()
): Promise<{ email: string; isNew: boolean } | null> {
	const request = await findRequestByToken(db, await sha256Base64Url(token), now.toISOString());
	if (!request) return null;
	return { email: request.email, isNew: !(await findUserByEmail(db, request.email)) };
}

export async function finishWithLink(
	db: D1Database,
	token: string,
	displayName: string,
	now = new Date()
): Promise<FinishResult> {
	const request = await findRequestByToken(db, await sha256Base64Url(token), now.toISOString());
	return request ? complete(db, request, displayName) : EXPIRED;
}

/**
 * The code works only with the request ids from the browser that asked for the emails. A wrong code
 * spends an attempt on each of them, so asking for more emails buys no extra guesses per email.
 */
export async function finishWithCode(
	db: D1Database,
	requestIds: readonly string[],
	code: string,
	displayName: string,
	now = new Date()
): Promise<FinishResult> {
	const ids = requestIds.slice(0, MAX_REQUESTS_PER_WINDOW);
	const typed = code.replace(/\s/g, '');
	const checked = await Promise.all(
		ids.map(async (id) => {
			const hash = await codeHash(id, typed);
			const request = await checkCode(db, id, hash, MAX_CODE_ATTEMPTS, now.toISOString());
			return { request, right: request?.code_hash === hash };
		})
	);
	const match = checked.find(({ right }) => right);
	if (match?.request) return complete(db, match.request, displayName);
	if (checked.some(({ request }) => request && request.code_attempts < MAX_CODE_ATTEMPTS)) {
		return NOT_RIGHT;
	}
	const unexpired = await findRequests(db, ids, now.toISOString());
	return unexpired.length > 0 ? TOO_MANY_WRONG_CODES : EXPIRED;
}

async function complete(
	db: D1Database,
	request: SignInRequestRow,
	displayName: string
): Promise<FinishResult> {
	let user = await findUserByEmail(db, request.email);
	const name = normalizeDisplayName(displayName);
	if (!user && !name) return { kind: 'needs-name', email: request.email };
	// Taken only now, so a new address can still add its name with the same link or code.
	if (!(await takeRequest(db, request.id))) return EXPIRED;
	user ??= await findOrCreateUser(db, request.email, name ?? '');
	return { kind: 'signed-in', userId: user.id, next: request.next_path };
}

function generateCode(): string {
	// The modulo bias over 2^32 values is too small to help a guesser.
	const [value] = crypto.getRandomValues(new Uint32Array(1));
	return String(value % 1_000_000).padStart(6, '0');
}

function codeHash(requestId: string, code: string): Promise<string> {
	return sha256Base64Url(`${requestId}:${code}`);
}

function signInEmail(to: string, link: string, code: string): SignInEmail {
	return {
		to,
		subject: 'Sign in to Huntboard',
		text: [
			'Open this link to sign in to Huntboard:',
			link,
			'',
			`Or type this code on the sign-in page: ${code}`,
			'',
			`The link and the code work once, for ${SIGN_IN_MINUTES} minutes.`,
			'If you did not ask to sign in, you can ignore this email.'
		].join('\n')
	};
}
