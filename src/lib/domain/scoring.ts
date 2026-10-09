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

const MS_PER_MINUTE = 60_000;

/** Whole minutes between the end time and the arrival, rounded down. 0 without both times or when on time. */
export function minutesLate(endsAt: string | null, arrivedAt: string | null): number {
	if (endsAt === null || arrivedAt === null) return 0;
	const lateMs = parseTimestamp(arrivedAt) - parseTimestamp(endsAt);
	return Math.max(0, Math.floor(lateMs / MS_PER_MINUTE));
}

export function latePenalty(
	endsAt: string | null,
	arrivedAt: string | null,
	penaltyPerMinute: number
): number {
	return minutesLate(endsAt, arrivedAt) * penaltyPerMinute;
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

	const rows = teams.map((team) => {
		const late = minutesLate(game.endsAt, team.arrivedAt);
		const penalty = late * game.latePenaltyPerMinute;
		const fromClaims = claimPoints.get(team.id) ?? 0;
		const fromAdjustments = adjustmentPoints.get(team.id) ?? 0;
		return {
			team,
			score: {
				teamId: team.id,
				name: team.name,
				claimPoints: fromClaims,
				adjustmentPoints: fromAdjustments,
				minutesLate: late,
				latePenalty: penalty,
				total: fromClaims + fromAdjustments - penalty,
				rank: 0
			}
		};
	});

	const ranks = rankByTotal(rows.map((row) => row.score.total));
	rows.forEach((row, i) => (row.score.rank = ranks[i]));

	return rows
		.sort((a, b) => a.score.rank - b.score.rank || a.team.position - b.team.position)
		.map((row) => row.score);
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
