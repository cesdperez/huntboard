import type { TeamRow, WithClaimCount } from './types.js';

export type TeamWithClaimCount = TeamRow & WithClaimCount;

export async function listTeamsWithClaimCounts(
	db: D1Database,
	gameId: number
): Promise<TeamWithClaimCount[]> {
	const { results } = await db
		.prepare(
			`SELECT team.*, (SELECT count(*) FROM claim WHERE claim.team_id = team.id) AS claim_count
			FROM team WHERE game_id = ? ORDER BY position, id`
		)
		.bind(gameId)
		.all<TeamWithClaimCount>();
	return results;
}
