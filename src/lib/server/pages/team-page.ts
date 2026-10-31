import { gamePhase } from '#lib/domain/game-window.js';
import type { GameImage } from '#lib/domain/images.js';
import { computeScoreboard, toStandings, type Standing } from '#lib/domain/scoring.js';
import { teamBoard, type TeamChallenge } from '#lib/domain/team-board.js';
import { listChallenges } from '../db/challenges.js';
import { listTeamClaims } from '../db/claims.js';
import { getScoreboardInput } from '../db/scoreboard.js';
import type { GameRow, TeamRow } from '../db/types.js';
import { gameImage } from './game-image-view.js';

/** What the team page sends to the browser. Times are UTC ISO strings. */
export interface TeamPageData {
	team: { name: string; members: string; avatarKey: string | null };
	game: { name: string; startsAt: string | null; endsAt: string | null; image: GameImage | null };
	standings: Standing[];
	/** Empty while challengesLocked. */
	challenges: TeamChallenge[];
	/** True before the start, unless the game shows its challenges early. */
	challengesLocked: boolean;
}

/** Holds only this team's claims: other teams show up as a name and a total. */
export async function getTeamPage(
	db: D1Database,
	team: TeamRow,
	game: GameRow,
	now: Date
): Promise<TeamPageData> {
	const challengesLocked = challengesLockedFor(game, now);
	const [challenges, claims, scoreboard] = await Promise.all([
		challengesLocked ? [] : listChallenges(db, game.id),
		challengesLocked ? [] : listTeamClaims(db, team.id),
		getScoreboardInput(db, game)
	]);
	return {
		team: { name: team.name, members: team.members, avatarKey: team.avatar_key },
		game: {
			name: game.name,
			startsAt: game.starts_at,
			endsAt: game.ends_at,
			image: gameImage(game)
		},
		standings: toStandings(computeScoreboard(scoreboard), team.id),
		challenges: teamBoard(challenges, claims),
		challengesLocked
	};
}

function challengesLockedFor(game: GameRow, now: Date): boolean {
	if (game.show_challenges_early) return false;
	return gamePhase({ startsAt: game.starts_at, endsAt: game.ends_at }, now) === 'before';
}
