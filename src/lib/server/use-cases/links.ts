import type { ActionOutcome } from './action-outcome.js';
import { rotateAdminToken, rotateScoreboardToken, rotateTeamToken } from '../db/links.js';
import { readId } from './form.js';

/** Which link a rotate action replaced: 'scoreboard' or `team-${id}`. */
export type RotatedLink = 'scoreboard' | `team-${number}`;

/** Shape of `page.form?.links` after a links action. */
export interface LinksFormResult {
	rotated?: RotatedLink;
	error?: string;
}

type LinksOutcome = ActionOutcome<LinksFormResult>;

/** The new admin token. The caller moves the organiser to it, because the old link stops working. */
export function rotateAdminLink(db: D1Database, gameId: number): Promise<string> {
	return rotateAdminToken(db, gameId);
}

export async function rotateScoreboardLink(db: D1Database, gameId: number): Promise<LinksOutcome> {
	await rotateScoreboardToken(db, gameId);
	return { status: 200, result: { rotated: 'scoreboard' } };
}

export async function rotateTeamLink(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<LinksOutcome> {
	const teamId = readId(data, 'teamId');
	const token = teamId === null ? null : await rotateTeamToken(db, gameId, teamId);
	if (teamId === null || !token) {
		return {
			status: 404,
			result: { error: 'That team is no longer in this game. Reload the page.' }
		};
	}
	return { status: 200, result: { rotated: `team-${teamId}` } };
}
