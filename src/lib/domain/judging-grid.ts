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
	/** Rejections of this team on this challenge other than the one the cell shows. */
	earlierRejections: EarlierRejections | null;
}

export interface EarlierRejections {
	count: number;
	/** The reason given for the latest of them. */
	lastNote: string | null;
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
	const teamClaims = teams.map((team) => claims.filter((claim) => claim.team_id === team.id));
	const columns = teamClaims.map((own) => teamBoard(challenges, own));

	return challenges.map((challenge, row) => ({
		...challengeFields(challenge),
		cells: teams.map((team, column) => {
			const claim = columns[column][row].claim;
			return {
				teamId: team.id,
				claim,
				earlierRejections: earlierRejections(teamClaims[column], challenge.id, claim?.id)
			};
		})
	}));
}

function earlierRejections(
	claims: GridClaim[],
	challengeId: number,
	shownId: number | undefined
): EarlierRejections | null {
	const rejected = claims
		.filter(
			(claim) =>
				claim.challenge_id === challengeId && claim.status === 'rejected' && claim.id !== shownId
		)
		.sort((a, b) => a.id - b.id);
	if (rejected.length === 0) return null;
	return { count: rejected.length, lastNote: rejected[rejected.length - 1].judge_note };
}
