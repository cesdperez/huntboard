import { MS_PER_MINUTE } from '../duration.js';

export type ClaimStatus = 'pending' | 'scored' | 'rejected';

export interface ScoringGame {
	/** UTC ISO timestamp, or null when the game has no end time. */
	endsAt: string | null;
	latePenaltyPerMinute: number;
}

export interface ScoringTeam {
	id: number;
	name: string;
	/** Admin-set display order, used to order tied teams. */
	position: number;
	/** UTC ISO timestamp, or null when no arrival is recorded. */
	arrivedAt: string | null;
}

export interface ScoringClaim {
	teamId: number;
	status: ClaimStatus;
	points: number | null;
}

export interface ScoringAdjustment {
	teamId: number;
	/** Signed: positive for a bonus, negative for a penalty. */
	points: number;
}

export interface TeamScore {
	teamId: number;
	name: string;
	claimPoints: number;
	adjustmentPoints: number;
	minutesLate: number;
	latePenalty: number;
	/** claimPoints + adjustmentPoints - latePenalty. Can be negative. */
	total: number;
	/** Standard competition ranking: tied teams share a rank and the next rank is skipped (1, 1, 3). */
	rank: number;
}

export interface ScoreboardInput {
	game: ScoringGame;
	teams: ScoringTeam[];
	claims: ScoringClaim[];
	adjustments: ScoringAdjustment[];
}

/** Whole minutes between the end time and the arrival, rounded down. 0 without both times or when on time. */
export function minutesLate(endsAt: string | null, arrivedAt: string | null): number {
	if (endsAt === null || arrivedAt === null) return 0;
	const lateMs = parseTimestamp(arrivedAt) - parseTimestamp(endsAt);
	return Math.max(0, Math.floor(lateMs / MS_PER_MINUTE));
}

/** Rank for each total, in input order, highest total first. */
export function rankByTotal(totals: number[]): number[] {
	return totals.map((total) => 1 + totals.filter((other) => other > total).length);
}

/** One row per team, ordered by rank and then by team position. */
export function computeScoreboard({
	game,
	teams,
	claims,
	adjustments
}: ScoreboardInput): TeamScore[] {
	const claimPoints = sumByTeam(
		claims.filter((claim) => claim.status === 'scored'),
		(claim) => claim.points ?? 0
	);
	const adjustmentPoints = sumByTeam(adjustments, (adjustment) => adjustment.points);

	const scores = teams.map((team) =>
		scoreTeam(team, game, claimPoints.get(team.id) ?? 0, adjustmentPoints.get(team.id) ?? 0)
	);
	const ranks = rankByTotal(scores.map((score) => score.total));

	return teams
		.map((team, i) => ({ position: team.position, score: { ...scores[i], rank: ranks[i] } }))
		.sort((a, b) => a.score.rank - b.score.rank || a.position - b.position)
		.map((row) => row.score);
}

/** A scoreboard row as players and spectators see it: no breakdown of where the points came from. */
export interface Standing {
	rank: number;
	name: string;
	total: number;
	/** True on the viewing team's own row. */
	own: boolean;
}

export function toStandings(scores: TeamScore[], ownTeamId: number | null): Standing[] {
	return scores.map((score) => ({
		rank: score.rank,
		name: score.name,
		total: score.total,
		own: score.teamId === ownTeamId
	}));
}

function scoreTeam(
	team: ScoringTeam,
	game: ScoringGame,
	claimPoints: number,
	adjustmentPoints: number
): Omit<TeamScore, 'rank'> {
	const late = minutesLate(game.endsAt, team.arrivedAt);
	const latePenalty = late * game.latePenaltyPerMinute;
	return {
		teamId: team.id,
		name: team.name,
		claimPoints,
		adjustmentPoints,
		minutesLate: late,
		latePenalty,
		total: claimPoints + adjustmentPoints - latePenalty
	};
}

function sumByTeam<T extends { teamId: number }>(
	items: T[],
	points: (item: T) => number
): Map<number, number> {
	const sums = new Map<number, number>();
	for (const item of items) {
		sums.set(item.teamId, (sums.get(item.teamId) ?? 0) + points(item));
	}
	return sums;
}

function parseTimestamp(value: string): number {
	const ms = Date.parse(value);
	if (Number.isNaN(ms)) throw new RangeError(`Invalid timestamp: ${value}`);
	return ms;
}
