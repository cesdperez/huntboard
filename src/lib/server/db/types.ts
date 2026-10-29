import type { ClaimStatus } from '#lib/domain/scoring.js';

/** Row types mirror the columns in migrations/, snake_case included. Times are UTC ISO strings. */
export interface GameRow {
	id: number;
	name: string;
	admin_token: string;
	scoreboard_token: string;
	starts_at: string | null;
	ends_at: string | null;
	late_penalty_per_minute: number;
	/** A theme id. Read it through resolveTheme, which handles ids no longer registered. */
	theme: string;
	created_at: string;
	/** Key in the IMAGES bucket, or null without a game image. */
	image_key: string | null;
	image_label: string;
	/** The account that created or claimed the game, or null for a game nobody claimed yet. */
	owner_user_id: number | null;
}

export interface TeamRow {
	id: number;
	game_id: number;
	name: string;
	members: string;
	token: string;
	position: number;
	arrived_at: string | null;
	/** Key in the IMAGES bucket, or null without a team picture. */
	avatar_key: string | null;
}

export interface ChallengeRow {
	id: number;
	game_id: number;
	title: string;
	title_key: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
	position: number;
}

export interface ClaimRow {
	id: number;
	team_id: number;
	challenge_id: number;
	status: ClaimStatus;
	note: string | null;
	marked_by: string;
	marked_at: string;
	points: number | null;
	judged_by: string | null;
	judged_at: string | null;
	judge_note: string | null;
}

export interface AdjustmentRow {
	id: number;
	team_id: number;
	/** Signed: positive for a bonus, negative for a penalty. */
	points: number;
	reason: string;
	created_by: string;
	created_at: string;
}

/** Counts every claim, rejected history included, because deleting cascades to all of them. */
export interface WithClaimCount {
	claim_count: number;
}

export type TeamWithClaimCount = TeamRow & WithClaimCount;

export type ChallengeWithClaimCount = ChallengeRow & WithClaimCount;

export interface UserRow {
	id: number;
	display_name: string;
	created_at: string;
}

export type IdentityProvider = 'google' | 'passkey' | 'test';

export interface IdentityRow {
	id: number;
	user_id: number;
	provider: IdentityProvider;
	/** Google's sub claim, or the passkey credential id in base64url. */
	subject: string;
	/** The Google email, or empty for a passkey. */
	label: string;
	/** Passkeys only: the COSE public key in base64url. */
	public_key: string | null;
	sign_count: number | null;
	/** Passkeys only: the authenticator transports as a JSON array. */
	transports: string | null;
	created_at: string;
}

export interface SessionRow {
	/** SHA-256 of the cookie token, in hex. */
	id: string;
	user_id: number;
	expires_at: string;
}
