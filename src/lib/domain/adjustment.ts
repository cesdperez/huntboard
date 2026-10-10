import { REASON_MAX_LENGTH } from '../reason.js';
import { parsePoints } from './points.js';

// Keeps any realistic sum of adjustments far below Number.MAX_SAFE_INTEGER.
export const ADJUSTMENT_MAX_POINTS = 100_000;

/** The add adjustment form's raw text fields. */
export interface AdjustmentInput {
	points: string;
	reason: string;
}

export interface Adjustment {
	/** Signed: positive for a bonus, negative for a penalty. Never 0. */
	points: number;
	reason: string;
}

export type AdjustmentErrors = Partial<Record<keyof AdjustmentInput, string>>;

export type AdjustmentResult =
	{ ok: true; adjustment: Adjustment } | { ok: false; errors: AdjustmentErrors };

export function validateAdjustment(input: AdjustmentInput): AdjustmentResult {
	const errors: AdjustmentErrors = {};

	const points = parsePoints(input.points);
	if (points === null || points === 0) {
		errors.points = 'Enter a whole number of points, like 10 or -5. Not 0.';
	} else if (Math.abs(points) > ADJUSTMENT_MAX_POINTS) {
		errors.points = `Keep it within ${ADJUSTMENT_MAX_POINTS} points either way.`;
	}

	const reason = input.reason.trim().replace(/\s+/g, ' ');
	if (!reason) errors.reason = 'Say why, so other judges know what it was for.';
	else if (reason.length > REASON_MAX_LENGTH) {
		errors.reason = `Keep the reason to at most ${REASON_MAX_LENGTH} characters.`;
	}

	if (points === null || Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, adjustment: { points, reason } };
}
