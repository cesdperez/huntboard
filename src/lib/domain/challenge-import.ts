import { parseChallenges, titleKey, type ParsedChallenge } from './challenge-parser.js';
import {
	diffReimport,
	type DeletedChallengeWithClaims,
	type ExistingChallenge,
	type ReimportDiff
} from './reimport-diff.js';

/** The stored columns of a challenge that an import writes. */
export interface ChallengeFields {
	title: string;
	title_key: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
	position: number;
}

export interface ImportPlan {
	inserts: ChallengeFields[];
	updates: (ChallengeFields & { id: number })[];
	/** Deleting a challenge cascades to its claims. */
	deleteIds: number[];
}

export interface ImportPreviewRow {
	title: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
	change: 'new' | 'updated';
}

export interface ImportPreviewError {
	line: number;
	message: string;
	/** The pasted line, so the admin can find it without counting. */
	source: string;
}

export interface ImportPreview {
	rows: ImportPreviewRow[];
	errors: ImportPreviewError[];
	deleted: string[];
	deletedWithClaims: DeletedChallengeWithClaims[];
	clampedScores: { title: string; teamName: string; from: number; to: number }[];
}

export function buildImportPlan(diff: ReimportDiff): ImportPlan {
	return {
		inserts: diff.added.map(toFields),
		updates: diff.matched.map(({ id, challenge }) => ({ id, ...toFields(challenge) })),
		deleteIds: [...diff.deleted, ...diff.deletedWithClaims].map(({ id }) => id)
	};
}

/** Deletions with claims missing from the preview the admin confirmed, because claims came in since. */
export function unacknowledgedDeletions(
	diff: ReimportDiff,
	acknowledgedIds: readonly number[]
): DeletedChallengeWithClaims[] {
	const acknowledged = new Set(acknowledgedIds);
	return diff.deletedWithClaims.filter(({ id }) => !acknowledged.has(id));
}

/** What confirming the pasted text would do, as described in docs/challenge-format.md. */
export function buildImportPreview(
	text: string,
	existing: readonly ExistingChallenge[],
	teamNames: ReadonlyMap<number, string>
): ImportPreview {
	const { challenges, errors } = parseChallenges(text);
	const diff = diffReimport(existing, challenges);
	const matched = new Set(diff.matched.map(({ challenge }) => challenge));
	const lines = text.split(/\r\n|\r|\n/);

	return {
		rows: challenges.map((challenge) => ({
			title: challenge.title,
			description: challenge.description,
			section: challenge.section,
			min_points: challenge.min_points,
			max_points: challenge.max_points,
			change: matched.has(challenge) ? 'updated' : 'new'
		})),
		errors: errors.map(({ line, message }) => ({
			line,
			message,
			source: (lines[line - 1] ?? '').trim()
		})),
		deleted: diff.deleted.map(({ title }) => title),
		deletedWithClaims: diff.deletedWithClaims,
		clampedScores: diff.clampedScores.map(({ title, teamId, from, to }) => ({
			title,
			teamName: teamNames.get(teamId) ?? 'A team',
			from,
			to
		}))
	};
}

function toFields(challenge: ParsedChallenge): ChallengeFields {
	return {
		title: challenge.title,
		title_key: titleKey(challenge.title),
		description: challenge.description,
		section: challenge.section,
		min_points: challenge.min_points,
		max_points: challenge.max_points,
		position: challenge.position
	};
}
