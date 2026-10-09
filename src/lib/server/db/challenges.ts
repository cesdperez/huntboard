import type { ChallengeWithClaimCount } from './types.js';

export async function listChallengesWithClaimCounts(
	db: D1Database,
	gameId: number
): Promise<ChallengeWithClaimCount[]> {
	const { results } = await db
		.prepare(
			`SELECT challenge.*,
				(SELECT count(*) FROM claim WHERE claim.challenge_id = challenge.id) AS claim_count
			FROM challenge WHERE game_id = ? ORDER BY position, id`
		)
		.bind(gameId)
		.all<ChallengeWithClaimCount>();
	return results;
}
