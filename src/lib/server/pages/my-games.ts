import { listGamesByOwner } from '../db/games.js';
import type { IdentityProvider, UserRow } from '../db/types.js';
import { listIdentities } from '../db/users.js';

/** A game on My games: what the list shows and the admin link it opens. */
export interface MyGame {
	name: string;
	adminToken: string;
	startsAt: string | null;
	createdAt: string;
}

/** A way to sign in, without the passkey's key material. */
export interface SignInMethod {
	provider: IdentityProvider;
	label: string;
	createdAt: string;
}

export async function getMyGames(db: D1Database, user: UserRow) {
	const [games, identities] = await Promise.all([
		listGamesByOwner(db, user.id),
		listIdentities(db, user.id)
	]);
	return {
		displayName: user.display_name,
		games: games.map((game): MyGame => ({
			name: game.name,
			adminToken: game.admin_token,
			startsAt: game.starts_at,
			createdAt: game.created_at
		})),
		methods: identities.map((identity): SignInMethod => ({
			provider: identity.provider,
			label: identity.label,
			createdAt: identity.created_at
		}))
	};
}
