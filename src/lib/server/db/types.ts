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
	/** teamNameKey(name), unique within the game. */
	name_key: string;
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
	/** Key in the MEDIA bucket, or null for a claim without a photo or video. */
	media_key: string | null;
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

/** Deleting a team without claims also deletes its adjustments, so Setup names them first. */
export type SetupTeam = TeamRow & WithClaimCount & { adjustment_count: number };

export type ChallengeWithClaimCount = ChallengeRow & WithClaimCount;

export interface UserRow {
	id: number;
	/** Lowercase. */
	email: string;
	display_name: string;
	created_at: string;
}

export interface SignInRequestRow {
	id: string;
	/** SHA-256 of the link token, in base64url. */
	token_hash: string;
	/** SHA-256 of the request id and the code, in base64url. */
	code_hash: string;
	email: string;
	next_path: string;
	code_attempts: number;
	expires_at: string;
	created_at: string;
}

export interface SessionRow {
	/** SHA-256 of the cookie token, in base64url. */
	id: string;
	user_id: number;
	expires_at: string;
}
