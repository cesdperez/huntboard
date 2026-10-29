import { env } from 'cloudflare:workers';
import { json, type RequestEvent } from '@sveltejs/kit';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { nextPath, normalizeDisplayName } from '#lib/domain/account.js';
import { getSignedInUser, signIn } from '../http/session.js';
import { resolveIntent, saveAttempt, takeAttempt } from '../http/sign-in-attempt.js';
import {
	beginPasskeyRegistration,
	beginPasskeySignIn,
	finishPasskeyRegistration,
	finishPasskeySignIn,
	type RelyingParty
} from '../use-cases/passkeys.js';
import { readIntent, NAME_ERROR } from './sign-in.js';

/** What the passkey endpoints answer: options to pass to the browser, where to go, or why not. */
export type PasskeyReply = { options: unknown } | { next: string } | { error: string };

const EXPIRED_MESSAGE = 'That passkey request took too long. Try again.';

/** Starts a passkey sign-in, sign-up, or addition to the signed-in account. */
export async function passkeyOptions({ request, cookies, url }: RequestEvent) {
	const body = await readJson(request);
	const intent = readIntent(body.intent);
	const typedName = typeof body.displayName === 'string' ? body.displayName : '';
	const rp = relyingParty(url);

	if (intent === 'sign-in') {
		const options = await beginPasskeySignIn(rp);
		saveAttempt(cookies, {
			intent,
			displayName: '',
			next: nextPath(body.next as string),
			challenge: options.challenge
		});
		return reply({ options });
	}

	const user = intent === 'link' ? await getSignedInUser(cookies) : null;
	const displayName = user?.display_name ?? normalizeDisplayName(typedName);
	if (intent === 'link' && !user) return reply({ error: EXPIRED_MESSAGE }, 401);
	if (!displayName) return reply({ error: NAME_ERROR }, 400);

	const options = await beginPasskeyRegistration(
		env.DB,
		rp,
		user ? { kind: 'link', userId: user.id } : { kind: 'sign-up', displayName },
		displayName
	);
	saveAttempt(cookies, {
		intent,
		displayName,
		next: intent === 'link' ? '/games' : nextPath(body.next as string),
		challenge: options.challenge
	});
	return reply({ options });
}

/** Checks what the browser's authenticator returned and signs in or adds the passkey. */
export async function passkeyVerify({ request, cookies, url }: RequestEvent) {
	const body = await readJson(request);
	const attempt = takeAttempt(cookies);
	const intent = attempt && resolveIntent(attempt, await getSignedInUser(cookies));
	if (!attempt?.challenge || !intent || typeof body.response !== 'object' || !body.response) {
		return reply({ error: EXPIRED_MESSAGE }, 400);
	}

	const rp = relyingParty(url);
	const outcome =
		intent.kind === 'sign-in'
			? await finishPasskeySignIn(
					env.DB,
					rp,
					attempt.challenge,
					body.response as AuthenticationResponseJSON
				)
			: await finishPasskeyRegistration(
					env.DB,
					rp,
					attempt.challenge,
					body.response as RegistrationResponseJSON,
					intent
				);
	if (outcome.kind === 'error') return reply({ error: outcome.message }, 400);
	if (outcome.kind === 'signed-in') await signIn(cookies, outcome.userId);
	return reply({ next: attempt.next });
}

function relyingParty(url: URL): RelyingParty {
	return { id: url.hostname, origin: url.origin };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const body: unknown = await request.json();
		return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function reply(body: PasskeyReply, status = 200) {
	return json(body, { status });
}
