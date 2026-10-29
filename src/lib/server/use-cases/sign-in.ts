import {
	addIdentity,
	createUserWithIdentity,
	findIdentity,
	type NewIdentity
} from '../db/users.js';

/** Why a sign-in method was asked for: to sign in, to create an account, or to add it to one. */
export type SignInIntent =
	{ kind: 'sign-in' } | { kind: 'sign-up'; displayName: string } | { kind: 'link'; userId: number };

/** A user to start a session for, a method added to the signed-in account, or why neither happened. */
export type SignInOutcome =
	{ kind: 'signed-in'; userId: number } | { kind: 'linked' } | { kind: 'error'; message: string };

export const TAKEN_MESSAGE = 'That sign-in already belongs to another Huntboard account.';

/**
 * Applies the intent to an identity the provider has just proven. Accounts are never matched by
 * email: an identity joins an account only through sign-up or while signed in to it.
 */
export async function applySignIn(
	db: D1Database,
	identity: NewIdentity,
	intent: SignInIntent,
	noAccountMessage: string
): Promise<SignInOutcome> {
	const existing = await findIdentity(db, identity.provider, identity.subject);
	switch (intent.kind) {
		case 'sign-in':
			if (!existing) return { kind: 'error', message: noAccountMessage };
			return { kind: 'signed-in', userId: existing.user_id };
		case 'sign-up': {
			if (existing) return { kind: 'signed-in', userId: existing.user_id };
			const user = await createUserWithIdentity(db, intent.displayName, identity);
			return { kind: 'signed-in', userId: user.id };
		}
		case 'link':
			if (existing) {
				return existing.user_id === intent.userId
					? { kind: 'linked' }
					: { kind: 'error', message: TAKEN_MESSAGE };
			}
			if (!(await addIdentity(db, intent.userId, identity))) {
				return { kind: 'error', message: TAKEN_MESSAGE };
			}
			return { kind: 'linked' };
	}
}
