import { JOIN_CODE_LENGTH, normalizeJoinCode } from '#lib/domain/join-code.js';
import type { ActionOutcome } from './action-outcome.js';
import { findTeamTokenByJoinCode } from '../db/links.js';
import { readString } from './form.js';

/** What /join shows again after a code that opened nothing. */
export interface JoinFormResult {
	code: string;
	error: string;
}

/** The team token to send the player to, or why the code opened nothing. */
export type JoinOutcome = { token: string } | ActionOutcome<JoinFormResult>;

/** Finds the team a typed join code belongs to. A wrong code says only that no team has it. */
export async function joinTeam(db: D1Database, data: FormData): Promise<JoinOutcome> {
	const typed = readString(data, 'code');
	if (!typed) {
		return {
			status: 400,
			result: { code: '', error: 'Type the join code your organiser gave you.' }
		};
	}
	const code = normalizeJoinCode(typed);
	if (!code) {
		return {
			status: 400,
			result: {
				code: typed,
				error: `A join code has ${JOIN_CODE_LENGTH} letters and digits, like K7Q4-M2XD.`
			}
		};
	}
	const token = await findTeamTokenByJoinCode(db, code);
	if (!token) {
		return {
			status: 404,
			result: { code: typed, error: 'No team has this code. Check it with your organiser.' }
		};
	}
	return { token };
}
