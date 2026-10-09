import type { ChallengeFields } from './challenge-import.js';
import { titleKey } from './challenge-parser.js';

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

/** Validates an in-place edit with the same rules the parser applies to pasted challenges. */
export function validateChallengeEdit(input: ChallengeEditInput): ChallengeEditResult {
	const errors: ChallengeEditErrors = {};
	const title = collapseSpaces(input.title);
	if (title === '') errors.title = 'Enter a title.';

	const min = wholeNumber(input.min);
	const max = wholeNumber(input.max);
	if (min === null) errors.min = WHOLE_NUMBER_ERROR;
	if (max === null) errors.max = WHOLE_NUMBER_ERROR;
	else if (min !== null && min > max) errors.max = `Max must be at least the min (${min}).`;

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
	if (!/^\d+$/.test(trimmed)) return null;
	const value = Number(trimmed);
	return Number.isSafeInteger(value) ? value : null;
}

function collapseSpaces(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}
