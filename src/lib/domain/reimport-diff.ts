import { titleKey, type ParsedChallenge } from './challenge-parser.js';
import { clampPoints, type PointsRange } from './points.js';

export interface ExistingClaim {
	id: number;
	team_id: number;
	status: 'pending' | 'scored' | 'rejected';
	points: number | null;
}

export interface ExistingChallenge {
	id: number;
	title: string;
	claims: ExistingClaim[];
}

export interface MatchedChallenge {
	/** Id of the stored challenge that the pasted one updates. */
	id: number;
	challenge: ParsedChallenge;
}

export interface DeletedChallenge {
	id: number;
	title: string;
}

export interface DeletedChallengeWithClaims extends DeletedChallenge {
	/** All claims the delete removes, pending and rejected included. */
	claimCount: number;
}

export interface ClampedScore {
	claimId: number;
	teamId: number;
	challengeId: number;
	/** The pasted title, which may differ in case or spacing from the stored one. */
	title: string;
	from: number;
	to: number;
}

export interface ReimportDiff {
	/** In pasted order. */
	matched: MatchedChallenge[];
	/** In pasted order. */
	added: ParsedChallenge[];
	/** In existing order. */
	deleted: DeletedChallenge[];
	/** In existing order. */
	deletedWithClaims: DeletedChallengeWithClaims[];
	/** Scored claims on matched challenges whose points fall outside the new range. */
	clampedScores: ClampedScore[];
}

/**
 * Compares the stored challenges of a game with a pasted list, matching by `titleKey`.
 * Throws when the pasted list repeats a title, since `parseChallenges` already refuses that.
 */
export function diffReimport(
	existing: readonly ExistingChallenge[],
	pasted: readonly ParsedChallenge[]
): ReimportDiff {
	assertUniqueTitles(pasted);
	const unmatched = indexByTitle(existing);
	const diff: ReimportDiff = {
		matched: [],
		added: [],
		deleted: [],
		deletedWithClaims: [],
		clampedScores: []
	};

	for (const challenge of pasted) {
		const key = titleKey(challenge.title);
		const stored = unmatched.get(key);
		if (stored) {
			unmatched.delete(key);
			diff.matched.push({ id: stored.id, challenge });
			diff.clampedScores.push(...clampedScores(stored, challenge));
		} else {
			diff.added.push(challenge);
		}
	}

	const matchedIds = new Set(diff.matched.map((m) => m.id));
	for (const stored of existing) {
		if (!matchedIds.has(stored.id)) addDeletion(diff, stored);
	}
	return diff;
}

function assertUniqueTitles(pasted: readonly ParsedChallenge[]): void {
	const seen = new Set<string>();
	for (const { title } of pasted) {
		const key = titleKey(title);
		if (seen.has(key)) throw new Error(`Duplicate title "${title}" in pasted challenges`);
		seen.add(key);
	}
}

/**
 * Keys are recomputed from the stored titles, so if titleKey ever folds more than the stored
 * title_key did, two stored titles can share a key. The first one then wins the match.
 */
function indexByTitle(existing: readonly ExistingChallenge[]): Map<string, ExistingChallenge> {
	const byTitle = new Map<string, ExistingChallenge>();
	for (const stored of existing) {
		const key = titleKey(stored.title);
		if (!byTitle.has(key)) byTitle.set(key, stored);
	}
	return byTitle;
}

function addDeletion(diff: ReimportDiff, stored: ExistingChallenge): void {
	const { id, title, claims } = stored;
	if (claims.length === 0) diff.deleted.push({ id, title });
	else diff.deletedWithClaims.push({ id, title, claimCount: claims.length });
}

function clampedScores(stored: ExistingChallenge, challenge: ParsedChallenge): ClampedScore[] {
	const range: PointsRange = { min: challenge.min_points, max: challenge.max_points };
	return stored.claims.flatMap((claim) => {
		if (claim.status !== 'scored' || claim.points === null) return [];
		const to = clampPoints(claim.points, range);
		if (to === claim.points) return [];
		return [
			{
				claimId: claim.id,
				teamId: claim.team_id,
				challengeId: stored.id,
				title: challenge.title,
				from: claim.points,
				to
			}
		];
	});
}
