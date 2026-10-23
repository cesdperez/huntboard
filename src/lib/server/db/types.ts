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
}

export interface TeamRow {
	id: number;
	game_id: number;
	name: string;
	members: string;
	token: string;
	position: number;
	arrived_at: string | null;
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
