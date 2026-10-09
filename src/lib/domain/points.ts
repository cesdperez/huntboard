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

function assertValidRange({ min, max }: PointsRange): void {
	if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
		throw new RangeError(`Invalid points range ${min}-${max}`);
	}
}
