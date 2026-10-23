import {
	buildImportPlan,
	buildImportPreview,
	unacknowledgedDeletions,
	type ImportPreview
} from '#lib/domain/challenge-import.js';
import {
	validateChallengeEdit,
	type ChallengeEditErrors,
	type ChallengeEditInput
} from '#lib/domain/challenge-edit.js';
import { parseChallenges } from '#lib/domain/challenge-parser.js';
import { diffReimport } from '#lib/domain/reimport-diff.js';
import type { ActionOutcome } from './action-outcome.js';
import { applyChallengeImport, getImportSource, updateChallenge } from './db/challenges.js';
import { readString } from './form.js';

/** What the challenges actions return under `page.form.challenges`. */
export type ChallengesFormResult =
	| { kind: 'preview'; text: string; preview: ImportPreview | null; error?: string }
	| { kind: 'imported'; count: number }
	| { kind: 'edit-failed'; id: number; values: ChallengeEditInput; errors: ChallengeEditErrors }
	| { kind: 'edited'; id: number; clampedCount: number };

type ChallengesOutcome = ActionOutcome<ChallengesFormResult>;

export const CHALLENGE_TEXT_MAX_LENGTH = 100_000;

const EMPTY_ERROR = 'Paste at least one challenge.';
const MISSING_ERROR = 'That challenge is not in this game any more. Reload the page.';

export async function previewChallengeImport(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<ChallengesOutcome> {
	const text = readText(data);
	const error = textError(text);
	if (error) return rejectText(400, text, null, error);

	const { existing, teamNames } = await getImportSource(db, gameId);
	const preview = buildImportPreview(text, existing, teamNames);
	return { status: 200, result: { kind: 'preview', text, preview } };
}

export async function importChallenges(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<ChallengesOutcome> {
	const text = readText(data);
	const error = textError(text);
	if (error) return rejectText(400, text, null, error);

	const { existing, teamNames } = await getImportSource(db, gameId);
	const preview = () => buildImportPreview(text, existing, teamNames);
	const { challenges, errors } = parseChallenges(text);
	if (errors.length > 0) {
		return rejectText(400, text, preview(), 'Fix the lines below before importing.');
	}
	if (challenges.length === 0) return rejectText(400, text, null, EMPTY_ERROR);

	const diff = diffReimport(existing, challenges);
	if (unacknowledgedDeletions(diff, readAcknowledgedIds(data)).length > 0) {
		return rejectText(
			409,
			text,
			preview(),
			'Claims came in since the preview. Check the list below and confirm again.'
		);
	}

	const result = await applyChallengeImport(db, gameId, buildImportPlan(diff));
	if (result.status === 'conflict') {
		const fresh = await getImportSource(db, gameId);
		return rejectText(
			409,
			text,
			buildImportPreview(text, fresh.existing, fresh.teamNames),
			'The challenges changed since the preview. Check the list below and confirm again.'
		);
	}
	return { status: 200, result: { kind: 'imported', count: challenges.length } };
}

export async function editChallenge(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<ChallengesOutcome> {
	const id = Number(readString(data, 'id'));
	const values: ChallengeEditInput = {
		title: readString(data, 'title'),
		description: readString(data, 'description'),
		section: readString(data, 'section'),
		min: readString(data, 'min'),
		max: readString(data, 'max')
	};
	const editFailed = (status: number, errors: ChallengeEditErrors, failedId = id) => ({
		status,
		result: { kind: 'edit-failed' as const, id: failedId, values, errors }
	});
	if (!Number.isInteger(id) || id <= 0) return editFailed(400, { title: MISSING_ERROR }, 0);

	const validated = validateChallengeEdit(values);
	if (!validated.ok) return editFailed(400, validated.errors);

	const result = await updateChallenge(db, gameId, id, validated.fields);
	switch (result.status) {
		case 'not-found':
			return editFailed(404, { title: MISSING_ERROR });
		case 'duplicate-title':
			return editFailed(400, { title: 'Another challenge already has this title.' });
		case 'updated':
			return { status: 200, result: { kind: 'edited', id, clampedCount: result.clampedCount } };
	}
}

/** Raw, not trimmed: parse errors point at line numbers in exactly what was pasted. */
function readText(data: FormData): string {
	const value = data.get('text');
	return typeof value === 'string' ? value : '';
}

function textError(text: string): string | null {
	if (text.trim() === '') return EMPTY_ERROR;
	if (text.length > CHALLENGE_TEXT_MAX_LENGTH) {
		return `The list is too long. Keep it under ${CHALLENGE_TEXT_MAX_LENGTH.toLocaleString('en')} characters.`;
	}
	return null;
}

function readAcknowledgedIds(data: FormData): number[] {
	return data
		.getAll('acknowledged')
		.map(Number)
		.filter((id) => Number.isInteger(id) && id > 0);
}

function rejectText(
	status: number,
	text: string,
	preview: ImportPreview | null,
	error: string
): ChallengesOutcome {
	return { status, result: { kind: 'preview', text, preview, error } };
}
