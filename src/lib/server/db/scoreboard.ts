import type {
	ScoreboardInput,
	ScoringAdjustment,
	ScoringClaim,
	ScoringTeam
} from '#lib/domain/scoring.js';
import type { GameRow } from './types.js';
import { GAME_CLAIMS } from './game-claims.js';

/** Everything computeScoreboard needs for one game, read in one round trip. */
export async function getScoreboardInput(
	db: D1Database,
	game: Pick<GameRow, 'id' | 'ends_at' | 'late_penalty_per_minute'>
): Promise<ScoreboardInput> {
	const [teams, claims, adjustments] = await db.batch([
		db
			.prepare(
				`SELECT id, name, members, position, arrived_at AS arrivedAt
				FROM team WHERE game_id = ? ORDER BY position, id`
			)
			.bind(game.id),
		db
			.prepare(
				`SELECT claim.team_id AS teamId, claim.status, claim.points
				FROM ${GAME_CLAIMS}
				WHERE team.game_id = ? AND claim.status = 'scored'
				ORDER BY claim.id`
			)
			.bind(game.id),
		db
			.prepare(
				`SELECT adjustment.team_id AS teamId, adjustment.points
				FROM adjustment JOIN team ON team.id = adjustment.team_id
				WHERE team.game_id = ?
				ORDER BY adjustment.id`
			)
			.bind(game.id)
	]);
	return {
		game: { endsAt: game.ends_at, latePenaltyPerMinute: game.late_penalty_per_minute },
		teams: teams.results as ScoringTeam[],
		claims: claims.results as ScoringClaim[],
		adjustments: adjustments.results as ScoringAdjustment[]
	};
}
