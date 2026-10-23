/** Highest score a challenge may award, so totals stay far below Number.MAX_SAFE_INTEGER. */
export const CHALLENGE_MAX_POINTS = 100_000;

/** Inclusive range of whole points a judge may award for a challenge. */
export type PointsRange = { min: number; max: number };

/** Moves a whole number of points into the range. Throws RangeError on fractions or a reversed range. */
export function clampPoints(value: number, range: PointsRange): number {
	assertValidRange(range);
	if (!Number.isInteger(value)) {
		throw new RangeError(`Points must be a whole number, got ${value}`);
	}
	return Math.min(range.max, Math.max(range.min, value));
}

/** Points picker shortcuts: min, middle rounded down and max, without duplicates, ascending. */
export function quickPointValues(range: PointsRange): number[] {
	assertValidRange(range);
	const middle = Math.floor((range.min + range.max) / 2);
	return [...new Set([range.min, middle, range.max])];
}

/** A typed whole number of points, possibly outside any range, or null when it is not one. */
export function parsePoints(value: string): number | null {
	const trimmed = value.trim();
	if (!/^-?\d+$/.test(trimmed)) return null;
	const points = Number(trimmed);
	return Number.isSafeInteger(points) ? points : null;
}

function assertValidRange({ min, max }: PointsRange): void {
	if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
		throw new RangeError(`Invalid points range ${min}-${max}`);
	}
}
