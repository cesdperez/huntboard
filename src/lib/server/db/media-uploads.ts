export interface MediaUploadLimits {
	uploadsPerChallenge: number;
	teamMaxBytes: number;
	gameMaxBytes: number;
}

export interface MediaUpload {
	gameId: number;
	teamId: number;
	key: string;
	size: number;
}

export type RecordUploadResult =
	'recorded' | 'team-count' | 'team-bytes' | 'game-bytes' | 'team-gone';

interface Usage {
	team_found: number;
	team_count: number;
	team_bytes: number;
	game_bytes: number;
	challenges: number;
}

/** Records the upload only if it keeps the team and the game within the limits. */
export async function recordMediaUpload(
	db: D1Database,
	{ gameId, teamId, key, size }: MediaUpload,
	limits: MediaUploadLimits
): Promise<RecordUploadResult> {
	// One statement, so two phones asking at once cannot both pass the check. The team check makes
	// a team deleted after its link was checked read as gone instead of failing the foreign key.
	const inserted = await db
		.prepare(
			`INSERT INTO media_upload (key, team_id, size)
			SELECT ?1, ?2, ?3
			WHERE EXISTS (SELECT 1 FROM team WHERE id = ?2 AND game_id = ?4)
				AND (SELECT count(*) FROM media_upload WHERE team_id = ?2)
					< ?5 * (SELECT count(*) FROM challenge WHERE game_id = ?4)
				AND (SELECT coalesce(sum(size), 0) FROM media_upload WHERE team_id = ?2) + ?3 <= ?6
				AND (SELECT coalesce(sum(size), 0) FROM media_upload
					JOIN team ON team.id = media_upload.team_id WHERE team.game_id = ?4) + ?3 <= ?7
			RETURNING key`
		)
		.bind(
			key,
			teamId,
			size,
			gameId,
			limits.uploadsPerChallenge,
			limits.teamMaxBytes,
			limits.gameMaxBytes
		)
		.first();
	if (inserted) return 'recorded';

	const usage = await db
		.prepare(
			`SELECT
				(SELECT count(*) FROM team WHERE id = ?1 AND game_id = ?2) AS team_found,
				(SELECT count(*) FROM media_upload WHERE team_id = ?1) AS team_count,
				(SELECT coalesce(sum(size), 0) FROM media_upload WHERE team_id = ?1) AS team_bytes,
				(SELECT coalesce(sum(size), 0) FROM media_upload
					JOIN team ON team.id = media_upload.team_id WHERE team.game_id = ?2) AS game_bytes,
				(SELECT count(*) FROM challenge WHERE game_id = ?2) AS challenges`
		)
		.bind(teamId, gameId)
		.first<Usage>();
	if (!usage?.team_found) return 'team-gone';
	if (usage.team_count >= limits.uploadsPerChallenge * usage.challenges) {
		return 'team-count';
	}
	if (usage.team_bytes + size > limits.teamMaxBytes) return 'team-bytes';
	return 'game-bytes';
}

export async function isTeamUpload(db: D1Database, teamId: number, key: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 FROM media_upload WHERE key = ? AND team_id = ?')
		.bind(key, teamId)
		.first();
	return row !== null;
}

/** Frees the game's budget, once its media is deleted. */
export async function clearGameUploads(db: D1Database, gameId: number): Promise<void> {
	await db
		.prepare('DELETE FROM media_upload WHERE team_id IN (SELECT id FROM team WHERE game_id = ?)')
		.bind(gameId)
		.run();
}
