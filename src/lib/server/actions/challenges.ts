import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
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
import { requireAdminGame } from '#lib/server/admin-game.js';
import {
	applyChallengeImport,
	getImportSource,
	updateChallenge
} from '#lib/server/db/challenges.js';
import { readString } from '#lib/server/form.js';
import type { AdminActions } from './types.js';

/** What the challenges actions return under `page.form.challenges`. */
export type ChallengesFormResult =
	| { kind: 'preview'; text: string; preview: ImportPreview | null; error?: string }
	| { kind: 'imported'; count: number }
	| { kind: 'edit-failed'; id: number; values: ChallengeEditInput; errors: ChallengeEditErrors }
	| { kind: 'edited'; id: number; clampedCount: number };

export const CHALLENGE_TEXT_MAX_LENGTH = 100_000;

const EMPTY_ERROR = 'Paste at least one challenge.';
const MISSING_ERROR = 'That challenge is not in this game any more. Reload the page.';

function challengesResult(result: ChallengesFormResult) {
	return { challenges: result };
}

function challengesFail(status: number, result: ChallengesFormResult) {
	return fail(status, challengesResult(result));
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

/** Setup tab actions. Names start with "challenges" so they cannot collide with other sections. */
export const challengesActions = {
	challengesPreview: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const text = readText(await request.formData());
		const error = textError(text);
		if (error) return challengesFail(400, { kind: 'preview', text, preview: null, error });

		const { existing, teamNames } = await getImportSource(env.DB, game.id);
		const preview = buildImportPreview(text, existing, teamNames);
		return challengesResult({ kind: 'preview', text, preview });
	},

	challengesImport: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		const text = readText(data);
		const error = textError(text);
		if (error) return challengesFail(400, { kind: 'preview', text, preview: null, error });

		const { existing, teamNames } = await getImportSource(env.DB, game.id);
		const preview = () => buildImportPreview(text, existing, teamNames);
		const { challenges, errors } = parseChallenges(text);
		if (errors.length > 0) {
			return challengesFail(400, {
				kind: 'preview',
				text,
				preview: preview(),
				error: 'Fix the lines below before importing.'
			});
		}
		if (challenges.length === 0) {
			return challengesFail(400, { kind: 'preview', text, preview: null, error: EMPTY_ERROR });
		}

		const diff = diffReimport(existing, challenges);
		if (unacknowledgedDeletions(diff, readAcknowledgedIds(data)).length > 0) {
			return challengesFail(409, {
				kind: 'preview',
				text,
				preview: preview(),
				error: 'Claims came in since the preview. Check the list below and confirm again.'
			});
		}

		await applyChallengeImport(env.DB, game.id, buildImportPlan(diff));
		return challengesResult({ kind: 'imported', count: challenges.length });
	},

	challengesEdit: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		const id = Number(readString(data, 'id'));
		const values: ChallengeEditInput = {
			title: readString(data, 'title'),
			description: readString(data, 'description'),
			section: readString(data, 'section'),
			min: readString(data, 'min'),
			max: readString(data, 'max')
		};
		if (!Number.isInteger(id) || id <= 0) {
			return challengesFail(400, {
				kind: 'edit-failed',
				id: 0,
				values,
				errors: { title: MISSING_ERROR }
			});
		}

		const validated = validateChallengeEdit(values);
		if (!validated.ok) {
			return challengesFail(400, { kind: 'edit-failed', id, values, errors: validated.errors });
		}

		const result = await updateChallenge(env.DB, game.id, id, validated.fields);
		switch (result.status) {
			case 'not-found':
				return challengesFail(404, {
					kind: 'edit-failed',
					id,
					values,
					errors: { title: MISSING_ERROR }
				});
			case 'duplicate-title':
				return challengesFail(400, {
					kind: 'edit-failed',
					id,
					values,
					errors: { title: 'Another challenge already has this title.' }
				});
			case 'updated':
				return challengesResult({ kind: 'edited', id, clampedCount: result.clampedCount });
		}
	}
} satisfies AdminActions;
