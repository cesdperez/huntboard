import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type AuthenticatorTransport,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { findIdentity, listIdentities, updatePasskeySignCount } from '../db/users.js';
import { applySignIn, type SignInIntent, type SignInOutcome } from './sign-in.js';

/** The site passkeys are bound to: the host name and the origin the browser reports. */
export interface RelyingParty {
	id: string;
	origin: string;
}

// EdDSA, ES256 and RS256. The library's default may add ML-DSA, too slow for the Workers CPU limit.
const ALGORITHMS = [-8, -7, -257];
const FAILED_MESSAGE = 'The passkey was not accepted. Try again.';
export const NO_PASSKEY_ACCOUNT_MESSAGE =
	'No Huntboard account uses that passkey. Create an account first.';

export type RegistrationIntent = Exclude<SignInIntent, { kind: 'sign-in' }>;

/** Options for navigator.credentials.create(). The caller keeps the challenge for the finish step. */
export async function beginPasskeyRegistration(
	db: D1Database,
	rp: RelyingParty,
	intent: RegistrationIntent,
	displayName: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
	const existing = intent.kind === 'link' ? await listIdentities(db, intent.userId) : [];
	return generateRegistrationOptions({
		rpName: 'Huntboard',
		rpID: rp.id,
		userName: displayName,
		userDisplayName: displayName,
		attestationType: 'none',
		// Lets the authenticator refuse a second passkey for an account it already holds one for.
		excludeCredentials: existing
			.filter((identity) => identity.provider === 'passkey')
			.map((identity) => ({
				id: identity.subject,
				transports: parseTransports(identity.transports)
			})),
		// A passkey is the only factor, so the authenticator must verify the user by biometrics or PIN.
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
		supportedAlgorithmIDs: ALGORITHMS
	});
}

export async function finishPasskeyRegistration(
	db: D1Database,
	rp: RelyingParty,
	expectedChallenge: string | null,
	response: RegistrationResponseJSON,
	intent: RegistrationIntent
): Promise<SignInOutcome> {
	if (!expectedChallenge) return { kind: 'error', message: FAILED_MESSAGE };
	let credential;
	try {
		const verification = await verifyRegistrationResponse({
			response,
			expectedChallenge,
			expectedOrigin: rp.origin,
			expectedRPID: rp.id,
			supportedAlgorithmIDs: ALGORITHMS
		});
		if (!verification.verified) return { kind: 'error', message: FAILED_MESSAGE };
		credential = verification.registrationInfo.credential;
	} catch {
		return { kind: 'error', message: FAILED_MESSAGE };
	}

	// Attestation 'none' signs nothing, so anyone can register a known credential id with their own
	// key. Only finishPasskeySignIn, which checks the stored key, may open an existing passkey's account.
	if (await findIdentity(db, 'passkey', credential.id)) {
		return { kind: 'error', message: FAILED_MESSAGE };
	}
	return applySignIn(
		db,
		{
			provider: 'passkey',
			subject: credential.id,
			public_key: isoBase64URL.fromBuffer(credential.publicKey),
			sign_count: credential.counter,
			transports: JSON.stringify(credential.transports ?? [])
		},
		intent,
		NO_PASSKEY_ACCOUNT_MESSAGE
	);
}

/** Options for navigator.credentials.get(). Any passkey for this site may answer. */
export function beginPasskeySignIn(
	rp: RelyingParty
): Promise<PublicKeyCredentialRequestOptionsJSON> {
	return generateAuthenticationOptions({ rpID: rp.id, userVerification: 'required' });
}

export async function finishPasskeySignIn(
	db: D1Database,
	rp: RelyingParty,
	expectedChallenge: string | null,
	response: AuthenticationResponseJSON
): Promise<SignInOutcome> {
	if (!expectedChallenge) return { kind: 'error', message: FAILED_MESSAGE };
	const identity = await findIdentity(db, 'passkey', response.id);
	if (!identity?.public_key) return { kind: 'error', message: NO_PASSKEY_ACCOUNT_MESSAGE };

	try {
		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge,
			expectedOrigin: rp.origin,
			expectedRPID: rp.id,
			credential: {
				id: identity.subject,
				publicKey: isoBase64URL.toBuffer(identity.public_key),
				counter: identity.sign_count ?? 0,
				transports: parseTransports(identity.transports)
			}
		});
		if (!verification.verified) return { kind: 'error', message: FAILED_MESSAGE };
		await updatePasskeySignCount(db, identity.id, verification.authenticationInfo.newCounter);
	} catch {
		return { kind: 'error', message: FAILED_MESSAGE };
	}
	return { kind: 'signed-in', userId: identity.user_id };
}

function parseTransports(json: string | null): AuthenticatorTransport[] | undefined {
	if (!json) return undefined;
	const value: unknown = JSON.parse(json);
	return Array.isArray(value) ? (value as AuthenticatorTransport[]) : undefined;
}
