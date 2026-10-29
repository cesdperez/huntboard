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
import { applyChallengeImport, getImportSource, updateChallenge } from '../db/challenges.js';
import { deleteObjects } from '../storage/bucket-objects.js';
import type { MediaBucket } from '../storage/media-store.js';
import { readId, readString } from './form.js';

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

/** Deletes the media of claims that go with deleted challenges, best effort. */
export async function importChallenges(
	db: D1Database,
	media: MediaBucket,
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
	if (unacknowledgedDeletions(diff, readAcknowledgedClaimCounts(data)).length > 0) {
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
	await deleteObjects(media, result.mediaKeys);
	return { status: 200, result: { kind: 'imported', count: challenges.length } };
}

export async function editChallenge(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<ChallengesOutcome> {
	const id = readId(data, 'id');
	const values: ChallengeEditInput = {
		title: readString(data, 'title'),
		description: readString(data, 'description'),
		section: readString(data, 'section'),
		min: readString(data, 'min'),
		max: readString(data, 'max')
	};
	const editFailed = (status: number, errors: ChallengeEditErrors) => ({
		status,
		result: { kind: 'edit-failed' as const, id: id ?? 0, values, errors }
	});
	if (id === null) return editFailed(400, { title: MISSING_ERROR });

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

/** Each `acknowledged` field is `id:claimCount`, the claims the admin saw in the preview. */
function readAcknowledgedClaimCounts(data: FormData): Map<number, number> {
	const counts = new Map<number, number>();
	for (const value of data.getAll('acknowledged')) {
		if (typeof value !== 'string') continue;
		const [id, claimCount] = value.split(':').map(Number);
		if (Number.isInteger(id) && id > 0 && Number.isInteger(claimCount) && claimCount >= 0) {
			counts.set(id, claimCount);
		}
	}
	return counts;
}

function rejectText(
	status: number,
	text: string,
	preview: ImportPreview | null,
	error: string
): ChallengesOutcome {
	return { status, result: { kind: 'preview', text, preview, error } };
}
