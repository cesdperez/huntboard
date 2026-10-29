import { claimMedia, type ClaimMedia } from '#lib/domain/claim-media.js';
import { judgingGrid, type GridRow, type GridTeam } from '#lib/domain/judging-grid.js';
import { computeScoreboard, type TeamScore } from '#lib/domain/scoring.js';
import { listAdjustments } from '../db/adjustments.js';
import { listChallenges } from '../db/challenges.js';
import { listGameClaims, listPendingClaims, type PendingClaimRow } from '../db/judging.js';
import { getScoreboardInputWithoutAdjustments } from '../db/scoreboard.js';
import { listTeamNames } from '../db/teams.js';
import type { GameRow } from '../db/types.js';

export interface QueueClaim extends PendingClaimRow {
	media: ClaimMedia | null;
}

export interface QueuePageData {
	/** Oldest first. */
	claims: QueueClaim[];
}

export async function getQueuePage(db: D1Database, gameId: number): Promise<QueuePageData> {
	const claims = await listPendingClaims(db, gameId);
	return { claims: claims.map((claim) => ({ ...claim, media: claimMedia(claim.media_key) })) };
}

export interface GridPageData {
	teams: GridTeam[];
	rows: GridRow[];
}

export async function getGridPage(db: D1Database, gameId: number): Promise<GridPageData> {
	const [challenges, claims, teams] = await Promise.all([
		listChallenges(db, gameId),
		listGameClaims(db, gameId),
		listTeamNames(db, gameId)
	]);
	return { teams, rows: judgingGrid(challenges, teams, claims) };
}

export interface AdjustmentItem {
	id: number;
	points: number;
	reason: string;
	createdBy: string;
	createdAt: string;
}

/** One team on the Teams tab. Times are UTC ISO strings. */
export interface TeamScoresRow extends Omit<TeamScore, 'teamId'> {
	id: number;
	arrivedAt: string | null;
	adjustments: AdjustmentItem[];
}

export interface TeamScoresPageData {
	game: { endsAt: string | null; latePenaltyPerMinute: number };
	/** In team order, not rank order, so rows stay put under the judge's thumb as totals change. */
	teams: TeamScoresRow[];
}

export async function getTeamScoresPage(
	db: D1Database,
	game: GameRow
): Promise<TeamScoresPageData> {
	const [input, adjustments] = await Promise.all([
		getScoreboardInputWithoutAdjustments(db, game),
		listAdjustments(db, game.id)
	]);
	const scoring = adjustments.map((a) => ({ teamId: a.team_id, points: a.points }));
	const scores = new Map(
		computeScoreboard({ ...input, adjustments: scoring }).map((score) => [score.teamId, score])
	);

	return {
		game: input.game,
		teams: input.teams.map((team) => {
			const { teamId, ...score } = scores.get(team.id)!;
			return {
				...score,
				id: teamId,
				arrivedAt: team.arrivedAt,
				adjustments: adjustments
					.filter((adjustment) => adjustment.team_id === team.id)
					.map((adjustment) => ({
						id: adjustment.id,
						points: adjustment.points,
						reason: adjustment.reason,
						createdBy: adjustment.created_by,
						createdAt: adjustment.created_at
					}))
			};
		})
	};
}
