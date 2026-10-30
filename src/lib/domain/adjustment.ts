import { normalizeReason, REASON_MAX_LENGTH, REASON_TOO_LONG } from './reason.js';
import { parsePoints } from './points.js';

// Keeps any realistic sum of adjustments far below Number.MAX_SAFE_INTEGER.
export const ADJUSTMENT_MAX_POINTS = 100_000;

/** The add adjustment form's raw text fields. */
export interface AdjustmentInput {
	/** "penalty" takes the points off; anything else is a bonus. */
	sign: string;
	/** The size, as typed. */
	points: string;
	reason: string;
}

export interface Adjustment {
	/** Signed: positive for a bonus, negative for a penalty. Never 0. */
	points: number;
	reason: string;
}

export type AdjustmentErrors = Partial<Record<'points' | 'reason', string>>;

export type AdjustmentResult =
	{ ok: true; adjustment: Adjustment } | { ok: false; errors: AdjustmentErrors };

export function validateAdjustment(input: AdjustmentInput): AdjustmentResult {
	const errors: AdjustmentErrors = {};

	const penalty = input.sign === 'penalty';
	const typed = input.points.trim();
	// Phones may type a Unicode minus. The choice sets the sign, so a penalty may repeat it.
	const minus = /^[-−]/.test(typed);
	const size = parsePoints(minus ? typed.slice(1) : typed);
	if (minus && !penalty) {
		errors.points = 'A bonus adds points. Choose Penalty to take points off.';
	} else if (size === null || size <= 0) {
		errors.points = 'Enter a whole number of points above 0, like 10.';
	} else if (size > ADJUSTMENT_MAX_POINTS) {
		errors.points = `Keep it within ${ADJUSTMENT_MAX_POINTS} points.`;
	}

	const reason = normalizeReason(input.reason);
	if (!reason) errors.reason = 'Say why, so other judges know what it was for.';
	else if (reason.length > REASON_MAX_LENGTH) errors.reason = REASON_TOO_LONG;

	if (size === null || Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, adjustment: { points: penalty ? -size : size, reason } };
}
