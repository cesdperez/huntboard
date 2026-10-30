import { clampPoints, parsePoints, type PointsRange } from '#lib/domain/points.js';

/**
 * Typed points moved into the challenge's range, with a note when that changed them, so a judge
 * sees why 99 became 25. Null for text that is not a whole number, which the server refuses.
 */
export function clampTypedPoints(
	typed: string,
	range: PointsRange
): { value: string; note: string | null } | null {
	const points = parsePoints(typed);
	if (points === null) return null;
	const clamped = clampPoints(points, range);
	if (clamped === points) return { value: String(points), note: null };
	const allowed =
		range.min === range.max ? `${range.min} points` : `${range.min} to ${range.max} points`;
	return {
		value: String(clamped),
		note: `This challenge gives ${allowed}, so ${points} became ${clamped}.`
	};
}
