import { computeScoreboard, toStandings, type Standing } from '#lib/domain/scoring.js';
import { getScoreboardInput } from './db/scoreboard.js';
import type { GameRow } from './db/types.js';

/** What the public scoreboard sends to the browser: names and totals only. Times are UTC ISO strings. */
export interface ScoreboardPageData {
	game: { name: string; startsAt: string | null; endsAt: string | null };
	standings: Standing[];
}

export async function getScoreboardPage(
	db: D1Database,
	game: GameRow
): Promise<ScoreboardPageData> {
	const scoreboard = await getScoreboardInput(db, game);
	return {
		game: { name: game.name, startsAt: game.starts_at, endsAt: game.ends_at },
		standings: toStandings(computeScoreboard(scoreboard), null)
	};
}
