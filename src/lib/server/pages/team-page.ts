import type { GameImage } from '#lib/domain/images.js';
import { computeScoreboard, toStandings, type Standing } from '#lib/domain/scoring.js';
import { teamBoard, type TeamChallenge } from '#lib/domain/team-board.js';
import { listChallenges } from '../db/challenges.js';
import { listTeamClaims } from '../db/claims.js';
import { getGameById } from '../db/games.js';
import { getTeamByToken } from '../db/links.js';
import { getScoreboardInput } from '../db/scoreboard.js';
import type { GameRow, TeamRow } from '../db/types.js';
import { gameImage } from './game-image-view.js';

export interface TeamLink {
	team: TeamRow;
	game: GameRow;
}

export async function findTeamLink(db: D1Database, token: string): Promise<TeamLink | null> {
	const team = await getTeamByToken(db, token);
	if (!team) return null;
	const game = await getGameById(db, team.game_id);
	return game && { team, game };
}

/** What the team page sends to the browser. Times are UTC ISO strings. */
export interface TeamPageData {
	team: { name: string; members: string; avatarKey: string | null };
	game: { name: string; startsAt: string | null; endsAt: string | null; image: GameImage | null };
	standings: Standing[];
	challenges: TeamChallenge[];
}

/** Holds only this team's claims: other teams show up as a name and a total. */
export async function getTeamPage(
	db: D1Database,
	team: TeamRow,
	game: GameRow
): Promise<TeamPageData> {
	const [challenges, claims, scoreboard] = await Promise.all([
		listChallenges(db, game.id),
		listTeamClaims(db, team.id),
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
		challenges: teamBoard(challenges, claims)
	};
}
