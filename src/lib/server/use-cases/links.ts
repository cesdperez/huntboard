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

const NOT_MADE_RIGHT: LinksOutcome = {
	status: 400,
	result: { error: 'The new link was not made right. Reload the page.' }
};
const TEAM_MISSING: LinksOutcome = {
	status: 404,
	result: { error: 'That team is no longer in this game. Reload the page.' }
};
const TAKEN: LinksOutcome = { status: 409, result: { error: 'That link is taken. Rotate again.' } };

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
	if (!isToken(token)) return NOT_MADE_RIGHT;
	if (!(await rotateAdminToken(db, gameId, token))) return TAKEN;
	return { token };
}

/** Moves the scoreboard to the token the browser made, so a retry after a lost answer sends it again. */
export async function rotateScoreboardLink(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<LinksOutcome> {
	const token = data.get('token');
	if (!isToken(token)) return NOT_MADE_RIGHT;
	if (!(await rotateScoreboardToken(db, gameId, token))) return TAKEN;
	return { status: 200, result: { rotated: 'scoreboard' } };
}

/** Moves the team to the token the browser made, like rotateScoreboardLink. */
export async function rotateTeamLink(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<LinksOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return TEAM_MISSING;
	const token = data.get('token');
	if (!isToken(token)) return NOT_MADE_RIGHT;
	switch (await rotateTeamToken(db, gameId, teamId, token)) {
		case 'not-found':
			return TEAM_MISSING;
		case 'taken':
			return TAKEN;
		case 'rotated':
			return { status: 200, result: { rotated: `team-${teamId}` } };
	}
}
