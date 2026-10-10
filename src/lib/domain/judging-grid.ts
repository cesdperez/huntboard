import {
	challengeFields,
	teamBoard,
	type BoardChallenge,
	type BoardClaim,
	type ChallengeFields,
	type TeamClaim
} from './team-board.js';

export interface GridTeam {
	id: number;
	name: string;
}

export interface GridClaim extends BoardClaim {
	team_id: number;
}

export interface GridCell {
	teamId: number;
	/** The claim this team sees on its own page, or null when the cell is open. */
	claim: TeamClaim | null;
}

export interface GridRow extends ChallengeFields {
	/** One cell per team, in the order the teams were given. */
	cells: GridCell[];
}

/** Challenges by teams, each cell showing the same claim the team sees on its page. */
export function judgingGrid(
	challenges: BoardChallenge[],
	teams: GridTeam[],
	claims: GridClaim[]
): GridRow[] {
	const columns = teams.map((team) =>
		teamBoard(
			challenges,
			claims.filter((claim) => claim.team_id === team.id)
		)
	);

	return challenges.map((challenge, row) => ({
		...challengeFields(challenge),
		cells: teams.map((team, column) => ({ teamId: team.id, claim: columns[column][row].claim }))
	}));
}
