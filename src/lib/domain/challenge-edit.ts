import { collapseSpaces } from '../format/text.js';
import type { ChallengeFields } from './challenge-import.js';
import { titleKey } from './challenge-parser.js';
import { CHALLENGE_MAX_POINTS } from './points.js';

/** The edit form's raw text fields. */
export interface ChallengeEditInput {
	title: string;
	description: string;
	section: string;
	min: string;
	max: string;
}

export type ChallengeEditFields = Omit<ChallengeFields, 'position'>;

export type ChallengeEditErrors = Partial<Record<keyof ChallengeEditInput, string>>;

export type ChallengeEditResult =
	{ ok: true; fields: ChallengeEditFields } | { ok: false; errors: ChallengeEditErrors };

const WHOLE_NUMBER_ERROR = 'Enter a whole number, 0 or more.';
const TOO_LARGE_ERROR = 'Points are too large.';

/** Validates an in-place edit with the same rules the parser applies to pasted challenges. */
export function validateChallengeEdit(input: ChallengeEditInput): ChallengeEditResult {
	const errors: ChallengeEditErrors = {};
	const title = collapseSpaces(input.title);
	if (title === '') errors.title = 'Enter a title.';

	const min = wholeNumber(input.min);
	const max = wholeNumber(input.max);
	const minError = pointsError(min);
	const maxError = pointsError(max);
	if (minError) errors.min = minError;
	if (maxError) errors.max = maxError;
	else if (min !== null && max !== null && min > max) {
		errors.max = `Max must be at least the min (${min}).`;
	}

	if (Object.keys(errors).length > 0 || min === null || max === null) return { ok: false, errors };

	const description = input.description.replace(/\r\n?/g, '\n').trim();
	return {
		ok: true,
		fields: {
			title,
			title_key: titleKey(title),
			description: description || null,
			section: collapseSpaces(input.section) || null,
			min_points: min,
			max_points: max
		}
	};
}

function wholeNumber(text: string): number | null {
	const trimmed = text.trim();
	return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function pointsError(points: number | null): string | undefined {
	if (points === null) return WHOLE_NUMBER_ERROR;
	return points > CHALLENGE_MAX_POINTS ? TOO_LARGE_ERROR : undefined;
}
