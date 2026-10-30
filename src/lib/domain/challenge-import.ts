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
	/** Unclaimed when previewed. A claim that arrives before the write keeps the challenge. */
	deleteIds: number[];
	/** Deletions the admin acknowledged. Deleting a challenge cascades to its claims. */
	deleteWithClaimsIds: number[];
}

export interface ImportPreviewRow {
	title: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
	change: 'new' | 'updated' | 'unchanged';
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
	reordered: boolean;
}

export function buildImportPlan(diff: ReimportDiff): ImportPlan {
	return {
		inserts: diff.added.map(toFields),
		updates: diff.matched.map(({ id, challenge }) => ({ id, ...toFields(challenge) })),
		deleteIds: diff.deleted.map(({ id }) => id),
		deleteWithClaimsIds: diff.deletedWithClaims.map(({ id }) => id)
	};
}

/** Deletions with more claims than the preview the admin confirmed, because claims came in since. */
export function unacknowledgedDeletions(
	diff: ReimportDiff,
	acknowledgedClaimCounts: ReadonlyMap<number, number>
): DeletedChallengeWithClaims[] {
	return diff.deletedWithClaims.filter(
		({ id, claimCount }) => claimCount > (acknowledgedClaimCounts.get(id) ?? 0)
	);
}

/** What confirming the pasted text would do, as described in docs/challenge-format.md. */
export function buildImportPreview(
	text: string,
	existing: readonly ExistingChallenge[],
	teamNames: ReadonlyMap<number, string>
): ImportPreview {
	const { challenges, errors } = parseChallenges(text);
	const diff = diffReimport(existing, challenges);
	const changes = new Map(
		diff.matched.map(
			({ challenge, changed }) => [challenge, changed ? 'updated' : 'unchanged'] as const
		)
	);
	const lines = text.split(/\r\n|\r|\n/);

	return {
		rows: challenges.map((challenge) => ({
			title: challenge.title,
			description: challenge.description,
			section: challenge.section,
			min_points: challenge.min_points,
			max_points: challenge.max_points,
			change: changes.get(challenge) ?? 'new'
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
		})),
		reordered: diff.reordered
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
