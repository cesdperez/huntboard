import type {
	ScoreboardInput,
	ScoringAdjustment,
	ScoringClaim,
	ScoringTeam
} from '#lib/domain/scoring.js';
import type { GameRow } from './types.js';
import { GAME_CLAIMS } from './game-claims.js';

type ScoringGameRow = Pick<GameRow, 'id' | 'ends_at' | 'late_penalty_per_minute'>;

/** Everything computeScoreboard needs for one game, read in one round trip. */
export async function getScoreboardInput(
	db: D1Database,
	game: ScoringGameRow
): Promise<ScoreboardInput> {
	const [teams, claims, adjustments] = await db.batch([
		...teamsAndClaimsStatements(db, game.id),
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
		...toInput(game, teams, claims),
		adjustments: adjustments.results as ScoringAdjustment[]
	};
}

/** getScoreboardInput for a caller that reads the full adjustment rows itself. */
export async function getScoreboardInputWithoutAdjustments(
	db: D1Database,
	game: ScoringGameRow
): Promise<Omit<ScoreboardInput, 'adjustments'>> {
	const [teams, claims] = await db.batch(teamsAndClaimsStatements(db, game.id));
	return toInput(game, teams, claims);
}

function teamsAndClaimsStatements(db: D1Database, gameId: number): D1PreparedStatement[] {
	return [
		db
			.prepare(
				`SELECT id, name, members, avatar_key AS avatarKey, position, arrived_at AS arrivedAt
				FROM team WHERE game_id = ? ORDER BY position, id`
			)
			.bind(gameId),
		db
			.prepare(
				`SELECT claim.team_id AS teamId, claim.status, claim.points
				FROM ${GAME_CLAIMS}
				WHERE team.game_id = ? AND claim.status = 'scored'
				ORDER BY claim.id`
			)
			.bind(gameId)
	];
}

function toInput(
	game: ScoringGameRow,
	teams: D1Result,
	claims: D1Result
): Omit<ScoreboardInput, 'adjustments'> {
	return {
		game: { endsAt: game.ends_at, latePenaltyPerMinute: game.late_penalty_per_minute },
		teams: teams.results as ScoringTeam[],
		claims: claims.results as ScoringClaim[]
	};
}
