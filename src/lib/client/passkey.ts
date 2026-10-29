import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
	WebAuthnError
} from '@simplewebauthn/browser';
import type { PasskeyReply } from '#lib/server/actions/passkeys.js';

export type PasskeyIntent = 'sign-in' | 'sign-up' | 'link';

export type PasskeyResult = { next: string } | { error: string };

/** Runs a passkey sign-in, sign-up or addition, from asking the server to its verdict. */
export async function runPasskey(
	intent: PasskeyIntent,
	fields: { displayName?: string; next?: string } = {}
): Promise<PasskeyResult> {
	if (!browserSupportsWebAuthn()) {
		return { error: 'This browser cannot use passkeys. Try another browser, or use Google.' };
	}
	try {
		const begun = await post('/login/passkey/options', { intent, ...fields });
		if (!('options' in begun)) return toResult(begun);
		const optionsJSON = begun.options as never;
		const response =
			intent === 'sign-in'
				? await startAuthentication({ optionsJSON })
				: await startRegistration({ optionsJSON });
		return toResult(await post('/login/passkey/verify', { response }));
	} catch (error) {
		return { error: passkeyErrorMessage(error) };
	}
}

export function passkeyErrorMessage(error: unknown): string {
	const code = error instanceof WebAuthnError ? error.code : null;
	if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
		return 'This device already has a passkey for your account.';
	}
	if (
		code === 'ERROR_CEREMONY_ABORTED' ||
		(error instanceof Error && error.name === 'NotAllowedError')
	) {
		return 'No passkey was used. Try again when you are ready.';
	}
	if (error instanceof TypeError) return 'No connection. Try again.';
	return 'The passkey did not work. Try again.';
}

async function post(path: string, body: unknown): Promise<PasskeyReply> {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return (await response.json()) as PasskeyReply;
}

function toResult(reply: PasskeyReply): PasskeyResult {
	if ('next' in reply) return { next: reply.next };
	if ('error' in reply) return { error: reply.error };
	return { error: 'The passkey did not work. Try again.' };
}
