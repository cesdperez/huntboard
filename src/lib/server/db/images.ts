/** What a key change replaced, so the caller can delete the old object. */
export interface ReplacedKey {
	previous: string | null;
}

/** Sets or (with a null key) clears the game image. Null when the game does not exist. */
export async function setGameImage(
	db: D1Database,
	gameId: number,
	key: string | null,
	label: string
): Promise<ReplacedKey | null> {
	// One batch is one transaction, so two replacements at once each get the key the other replaced.
	const [previous] = await db.batch<{ key: string | null }>([
		db.prepare('SELECT image_key AS key FROM game WHERE id = ?').bind(gameId),
		db
			.prepare('UPDATE game SET image_key = ?, image_label = ? WHERE id = ?')
			.bind(key, label, gameId)
	]);
	const row = previous.results[0];
	return row ? { previous: row.key } : null;
}

export async function setGameImageLabel(
	db: D1Database,
	gameId: number,
	label: string
): Promise<void> {
	await db.prepare('UPDATE game SET image_label = ? WHERE id = ?').bind(label, gameId).run();
}

/** Sets or (with a null key) clears the team picture. Null when the team is not in this game. */
export async function setTeamAvatar(
	db: D1Database,
	gameId: number,
	teamId: number,
	key: string | null
): Promise<ReplacedKey | null> {
	const [previous] = await db.batch<{ key: string | null }>([
		db
			.prepare('SELECT avatar_key AS key FROM team WHERE id = ? AND game_id = ?')
			.bind(teamId, gameId),
		db
			.prepare('UPDATE team SET avatar_key = ? WHERE id = ? AND game_id = ?')
			.bind(key, teamId, gameId)
	]);
	const row = previous.results[0];
	return row ? { previous: row.key } : null;
}
