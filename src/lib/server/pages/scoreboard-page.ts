import type { GameImage } from '#lib/domain/images.js';
import { computeScoreboard, toStandings, type Standing } from '#lib/domain/scoring.js';
import { getScoreboardInput } from '../db/scoreboard.js';
import type { GameRow } from '../db/types.js';
import { gameImage } from './game-image-view.js';

/** What the public scoreboard sends to the browser: names and totals only. Times are UTC ISO strings. */
export interface ScoreboardPageData {
	game: { name: string; startsAt: string | null; endsAt: string | null; image: GameImage | null };
	standings: Standing[];
}

export async function getScoreboardPage(
	db: D1Database,
	game: GameRow
): Promise<ScoreboardPageData> {
	const scoreboard = await getScoreboardInput(db, game);
	return {
		game: {
			name: game.name,
			startsAt: game.starts_at,
			endsAt: game.ends_at,
			image: gameImage(game)
		},
		standings: toStandings(computeScoreboard(scoreboard), null)
	};
}

type ScoreboardCache = Pick<Cache, 'match' | 'put'>;

/** Every viewer of one game polls the same standings, so they share one read per 15 seconds. */
const SCOREBOARD_CACHE_SECONDS = 15;

export async function getCachedScoreboardPage(
	db: D1Database,
	game: GameRow,
	origin: string,
	cache: ScoreboardCache | undefined
): Promise<ScoreboardPageData> {
	if (!cache) return getScoreboardPage(db, game);
	const key = `${origin}/__cache/scoreboard/${game.id}`;
	const cached = await cache.match(key);
	if (cached) return cached.json();

	const page = await getScoreboardPage(db, game);
	await cache.put(
		key,
		Response.json(page, { headers: { 'Cache-Control': `max-age=${SCOREBOARD_CACHE_SECONDS}` } })
	);
	return page;
}
