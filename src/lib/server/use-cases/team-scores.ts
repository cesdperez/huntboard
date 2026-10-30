import {
	validateAdjustment,
	type AdjustmentErrors,
	type AdjustmentInput
} from '#lib/domain/adjustment.js';
import { normalizeNickname } from '#lib/domain/nickname.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { addAdjustment, deleteAdjustment } from '../db/adjustments.js';
import { recordFirstArrival, setArrival } from '../db/teams.js';
import { readId, readString, readUtcTime } from './form.js';

/** What the Teams tab actions return under `teamScores`. */
export type TeamScoresFormResult =
	| { kind: 'adjusted' }
	| { kind: 'adjustment-invalid'; values: AdjustmentInput; errors: AdjustmentErrors }
	| { kind: 'adjustment-removed' }
	| { kind: 'arrival' }
	| ErrorResult;

type TeamScoresOutcome = ActionOutcome<TeamScoresFormResult>;

const TEAM_GONE = 'That team is not in this game any more. Reload the page.';

export async function addTeamAdjustment(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamScoresOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return error(404, TEAM_GONE);
	const createdBy = normalizeNickname(data.get('nickname'));
	if (!createdBy) {
		return error(400, 'Set your nickname first, so everyone knows who added this.');
	}

	const values = {
		sign: readString(data, 'sign'),
		points: readString(data, 'points'),
		reason: readString(data, 'reason')
	};
	const validated = validateAdjustment(values);
	if (!validated.ok) {
		return {
			status: 400,
			result: { kind: 'adjustment-invalid', values, errors: validated.errors }
		};
	}

	const added = await addAdjustment(db, gameId, teamId, { ...validated.adjustment, createdBy });
	if (!added) return error(404, TEAM_GONE);
	return { status: 200, result: { kind: 'adjusted' } };
}

export async function removeAdjustment(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamScoresOutcome> {
	const adjustmentId = readId(data, 'adjustmentId');
	if (adjustmentId === null || !(await deleteAdjustment(db, gameId, adjustmentId))) {
		return error(404, 'This adjustment was already removed.');
	}
	return { status: 200, result: { kind: 'adjustment-removed' } };
}

/**
 * Takes the server clock, so a slow phone clock cannot shift the penalty. A second tap never moves
 * a recorded arrival: a judge whose page is behind would add minutes of penalty unseen.
 */
export async function recordArrival(
	db: D1Database,
	gameId: number,
	data: FormData,
	now: Date
): Promise<TeamScoresOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return error(404, TEAM_GONE);
	switch (await recordFirstArrival(db, gameId, teamId, now.toISOString())) {
		case 'recorded':
			return { status: 200, result: { kind: 'arrival' } };
		case 'already-recorded':
			return error(409, 'The arrival was already recorded. Correct the time if it is wrong.');
		case 'not-found':
			return error(404, TEAM_GONE);
	}
}

/** The browser sends the corrected time already converted to UTC ISO. */
export async function correctArrival(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamScoresOutcome> {
	const teamId = readId(data, 'teamId');
	const arrivedAt = readUtcTime(data, 'arrivedAt');
	if (!arrivedAt) return error(400, 'Enter the time the team arrived.');
	return saveArrival(db, gameId, teamId, arrivedAt);
}

export function clearArrival(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamScoresOutcome> {
	return saveArrival(db, gameId, readId(data, 'teamId'), null);
}

// Last write wins: correct and clear act on a time the judge saw.
async function saveArrival(
	db: D1Database,
	gameId: number,
	teamId: number | null,
	arrivedAt: string | null
): Promise<TeamScoresOutcome> {
	if (teamId === null || !(await setArrival(db, gameId, teamId, arrivedAt))) {
		return error(404, TEAM_GONE);
	}
	return { status: 200, result: { kind: 'arrival' } };
}
