import { isToken } from '#lib/domain/token.js';
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

/** The new admin token on success, for the caller to move the organiser to, as the old link stops working. */
export type RotateAdminOutcome = { token: string } | LinksOutcome;

/**
 * Moves the game to the admin token the browser made. The browser makes it, so when the answer is
 * lost it can still check the new link and go there, instead of staying on the dead one.
 */
export async function rotateAdminLink(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<RotateAdminOutcome> {
	const token = data.get('adminToken');
	if (!isToken(token)) {
		return { status: 400, result: { error: 'The new link was not made right. Reload the page.' } };
	}
	if (!(await rotateAdminToken(db, gameId, token))) {
		return { status: 409, result: { error: 'That link is taken. Rotate again.' } };
	}
	return { token };
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
