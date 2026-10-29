import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testing/test-db.js';
import { createUserWithIdentity, findIdentity } from '../db/users.js';
import {
	beginPasskeyRegistration,
	beginPasskeySignIn,
	finishPasskeyRegistration,
	finishPasskeySignIn,
	NO_PASSKEY_ACCOUNT_MESSAGE
} from './passkeys.js';

const mocks = vi.hoisted(() => ({
	verifyRegistrationResponse: vi.fn(),
	verifyAuthenticationResponse: vi.fn()
}));

vi.mock('@simplewebauthn/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@simplewebauthn/server')>()),
	verifyRegistrationResponse: mocks.verifyRegistrationResponse,
	verifyAuthenticationResponse: mocks.verifyAuthenticationResponse
}));

const rp = { id: 'huntboard.example', origin: 'https://huntboard.example' };
const registration = { id: 'credential-1' } as Parameters<typeof finishPasskeyRegistration>[3];
const assertion = { id: 'credential-1' } as Parameters<typeof finishPasskeySignIn>[3];

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
	vi.clearAllMocks();
	mocks.verifyRegistrationResponse.mockResolvedValue({
		verified: true,
		registrationInfo: {
			credential: {
				id: 'credential-1',
				publicKey: new Uint8Array([1, 2, 3]),
				counter: 0,
				transports: ['internal', 'hybrid']
			}
		}
	});
	mocks.verifyAuthenticationResponse.mockResolvedValue({
		verified: true,
		authenticationInfo: { newCounter: 5 }
	});
});

async function samWithPasskey() {
	return createUserWithIdentity(db, 'Sam', {
		provider: 'passkey',
		subject: 'credential-1',
		public_key: 'AQID',
		sign_count: 2,
		transports: '["internal"]'
	});
}

describe('beginPasskeyRegistration', () => {
	it('asks for a discoverable passkey with user verification, named after the display name', async () => {
		const options = await beginPasskeyRegistration(
			db,
			rp,
			{ kind: 'sign-up', displayName: 'Sam' },
			'Sam'
		);

		expect(options).toMatchObject({
			rp: { id: 'huntboard.example', name: 'Huntboard' },
			user: { name: 'Sam', displayName: 'Sam' },
			authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
			excludeCredentials: []
		});
		expect(options.pubKeyCredParams.map((param) => param.alg)).toEqual([-8, -7, -257]);
	});

	it('excludes the passkeys the account already has when adding one', async () => {
		const sam = await samWithPasskey();

		const options = await beginPasskeyRegistration(db, rp, { kind: 'link', userId: sam.id }, 'Sam');

		expect(options.excludeCredentials).toEqual([
			{ id: 'credential-1', type: 'public-key', transports: ['internal'] }
		]);
	});
});

describe('finishPasskeyRegistration', () => {
	it('creates the account with the verified passkey', async () => {
		const outcome = await finishPasskeyRegistration(db, rp, 'challenge-1', registration, {
			kind: 'sign-up',
			displayName: 'Sam'
		});

		expect(outcome).toMatchObject({ kind: 'signed-in' });
		expect(mocks.verifyRegistrationResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedChallenge: 'challenge-1',
				expectedOrigin: 'https://huntboard.example',
				expectedRPID: 'huntboard.example'
			})
		);
		expect(await findIdentity(db, 'passkey', 'credential-1')).toMatchObject({
			public_key: 'AQID',
			sign_count: 0,
			transports: '["internal","hybrid"]'
		});
	});

	it('refuses without a stored challenge', async () => {
		const outcome = await finishPasskeyRegistration(db, rp, null, registration, {
			kind: 'sign-up',
			displayName: 'Sam'
		});

		expect(outcome).toMatchObject({ kind: 'error' });
		expect(mocks.verifyRegistrationResponse).not.toHaveBeenCalled();
	});

	it('refuses a response that fails verification', async () => {
		mocks.verifyRegistrationResponse.mockRejectedValue(new Error('Unexpected challenge'));

		const outcome = await finishPasskeyRegistration(db, rp, 'challenge-1', registration, {
			kind: 'sign-up',
			displayName: 'Sam'
		});

		expect(outcome).toMatchObject({ kind: 'error' });
		expect(await findIdentity(db, 'passkey', 'credential-1')).toBeNull();
	});
});

describe('passkey sign-in', () => {
	it('offers any passkey for the site', async () => {
		const options = await beginPasskeySignIn(rp);

		expect(options).toMatchObject({ rpId: 'huntboard.example', userVerification: 'required' });
		expect(options.allowCredentials ?? []).toEqual([]);
	});

	it('signs in the owner of the passkey and stores the new counter', async () => {
		const sam = await samWithPasskey();

		expect(await finishPasskeySignIn(db, rp, 'challenge-1', assertion)).toEqual({
			kind: 'signed-in',
			userId: sam.id
		});
		expect(mocks.verifyAuthenticationResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedChallenge: 'challenge-1',
				credential: {
					id: 'credential-1',
					publicKey: new Uint8Array([1, 2, 3]),
					counter: 2,
					transports: ['internal']
				}
			})
		);
		expect(await findIdentity(db, 'passkey', 'credential-1')).toMatchObject({ sign_count: 5 });
	});

	it('tells an unknown passkey to create an account first', async () => {
		expect(await finishPasskeySignIn(db, rp, 'challenge-1', assertion)).toEqual({
			kind: 'error',
			message: NO_PASSKEY_ACCOUNT_MESSAGE
		});
	});

	it('refuses a signature that does not verify, and keeps the counter', async () => {
		await samWithPasskey();
		mocks.verifyAuthenticationResponse.mockResolvedValue({ verified: false });

		expect(await finishPasskeySignIn(db, rp, 'challenge-1', assertion)).toMatchObject({
			kind: 'error'
		});
		expect(await findIdentity(db, 'passkey', 'credential-1')).toMatchObject({ sign_count: 2 });
	});
});
