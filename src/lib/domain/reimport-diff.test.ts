import { describe, expect, it } from 'vitest';
import type { ParsedChallenge } from './challenge-parser.js';
import { diffReimport, type ExistingChallenge, type ExistingClaim } from './reimport-diff.js';

function parsed(title: string, overrides: Partial<ParsedChallenge> = {}): ParsedChallenge {
	return {
		title,
		description: null,
		section: null,
		min_points: 5,
		max_points: 20,
		position: 0,
		...overrides
	};
}

function existing(id: number, title: string, claims: ExistingClaim[] = []): ExistingChallenge {
	return { id, title, claims };
}

function scored(id: number, points: number, team_id = 1): ExistingClaim {
	return { id, team_id, status: 'scored', points };
}

describe('diffReimport', () => {
	it('adds every challenge when nothing exists yet', () => {
		const swim = parsed('Swim in a fountain');
		const card = parsed('Make a birthday card', { position: 1 });

		const diff = diffReimport([], [swim, card]);

		expect(diff.added).toEqual([swim, card]);
		expect(diff.matched).toEqual([]);
		expect(diff.deleted).toEqual([]);
		expect(diff.deletedWithClaims).toEqual([]);
		expect(diff.clampedScores).toEqual([]);
	});

	it('deletes every challenge when the new list is empty', () => {
		const diff = diffReimport([existing(1, 'Swim'), existing(2, 'Run')], []);

		expect(diff.deleted).toEqual([
			{ id: 1, title: 'Swim' },
			{ id: 2, title: 'Run' }
		]);
		expect(diff.added).toEqual([]);
		expect(diff.matched).toEqual([]);
	});

	it('matches a challenge with the same title and keeps its id', () => {
		const swim = parsed('Swim in a fountain', { min_points: 10, max_points: 30 });

		const diff = diffReimport([existing(7, 'Swim in a fountain')], [swim]);

		expect(diff.matched).toEqual([{ id: 7, challenge: swim }]);
		expect(diff.added).toEqual([]);
		expect(diff.deleted).toEqual([]);
	});

	it('matches titles ignoring case, surrounding spaces and repeated spaces', () => {
		const swim = parsed('swim IN a fountain');

		const diff = diffReimport([existing(7, '  Swim in  a Fountain ')], [swim]);

		expect(diff.matched).toEqual([{ id: 7, challenge: swim }]);
	});

	it('treats a changed title as one deletion and one addition', () => {
		const fixed = parsed('Swim in a fountain');

		const diff = diffReimport([existing(7, 'Swim in a fountian')], [fixed]);

		expect(diff.added).toEqual([fixed]);
		expect(diff.deleted).toEqual([{ id: 7, title: 'Swim in a fountian' }]);
		expect(diff.matched).toEqual([]);
	});

	it('sorts a mixed re-import into matched, added, deleted and deleted with claims', () => {
		const keep = parsed('Keep', { position: 0 });
		const fresh = parsed('Fresh', { position: 1 });

		const diff = diffReimport(
			[
				existing(1, 'Keep', [scored(10, 10)]),
				existing(2, 'Unclaimed'),
				existing(3, 'Claimed', [scored(11, 15), scored(12, 5, 2)])
			],
			[keep, fresh]
		);

		expect(diff.matched).toEqual([{ id: 1, challenge: keep }]);
		expect(diff.added).toEqual([fresh]);
		expect(diff.deleted).toEqual([{ id: 2, title: 'Unclaimed' }]);
		expect(diff.deletedWithClaims).toEqual([{ id: 3, title: 'Claimed', claimCount: 2 }]);
	});

	it('keeps matched and added in pasted order and deletions in existing order', () => {
		const a = parsed('A', { position: 0 });
		const b = parsed('B', { position: 1 });
		const c = parsed('C', { position: 2 });
		const d = parsed('D', { position: 3 });

		const diff = diffReimport(
			[existing(1, 'Z'), existing(2, 'C'), existing(3, 'Y'), existing(4, 'A')],
			[a, b, c, d]
		);

		expect(diff.matched.map((m) => m.challenge.title)).toEqual(['A', 'C']);
		expect(diff.added.map((challenge) => challenge.title)).toEqual(['B', 'D']);
		expect(diff.deleted.map((challenge) => challenge.title)).toEqual(['Z', 'Y']);
	});

	it('counts pending and rejected claims on a deleted challenge, since deleting removes them too', () => {
		const diff = diffReimport(
			[
				existing(3, 'Claimed', [
					{ id: 1, team_id: 1, status: 'pending', points: null },
					{ id: 2, team_id: 2, status: 'rejected', points: null }
				])
			],
			[]
		);

		expect(diff.deletedWithClaims).toEqual([{ id: 3, title: 'Claimed', claimCount: 2 }]);
		expect(diff.deleted).toEqual([]);
	});

	describe('clamped scores', () => {
		it('lists a scored claim above the new max, lowered to the max', () => {
			const diff = diffReimport(
				[existing(7, 'Swim', [scored(42, 25, 3)])],
				[parsed('Swim', { min_points: 5, max_points: 20 })]
			);

			expect(diff.clampedScores).toEqual([
				{ claimId: 42, teamId: 3, challengeId: 7, title: 'Swim', from: 25, to: 20 }
			]);
		});

		it('lists a scored claim below the new min, raised to the min', () => {
			const diff = diffReimport(
				[existing(7, 'Swim', [scored(42, 2)])],
				[parsed('Swim', { min_points: 5, max_points: 20 })]
			);

			expect(diff.clampedScores).toEqual([
				{ claimId: 42, teamId: 1, challengeId: 7, title: 'Swim', from: 2, to: 5 }
			]);
		});

		it('leaves out scored claims already inside the new range, bounds included', () => {
			const diff = diffReimport(
				[existing(7, 'Swim', [scored(1, 5), scored(2, 12, 2), scored(3, 20, 3)])],
				[parsed('Swim', { min_points: 5, max_points: 20 })]
			);

			expect(diff.clampedScores).toEqual([]);
		});

		it('clamps every out of range score to a single value range', () => {
			const diff = diffReimport(
				[existing(7, 'Swim', [scored(1, 10), scored(2, 25, 2), scored(3, 40, 3)])],
				[parsed('Swim', { min_points: 25, max_points: 25 })]
			);

			expect(diff.clampedScores.map(({ claimId, from, to }) => ({ claimId, from, to }))).toEqual([
				{ claimId: 1, from: 10, to: 25 },
				{ claimId: 3, from: 40, to: 25 }
			]);
		});

		it('ignores pending and rejected claims, which have no score to clamp', () => {
			const diff = diffReimport(
				[
					existing(7, 'Swim', [
						{ id: 1, team_id: 1, status: 'pending', points: null },
						{ id: 2, team_id: 2, status: 'rejected', points: 99 }
					])
				],
				[parsed('Swim', { min_points: 5, max_points: 20 })]
			);

			expect(diff.clampedScores).toEqual([]);
		});

		it('ignores scores on deleted challenges, which are removed instead', () => {
			const diff = diffReimport([existing(7, 'Swim', [scored(1, 99)])], []);

			expect(diff.clampedScores).toEqual([]);
		});

		it('names the challenge by its new title', () => {
			const diff = diffReimport(
				[existing(7, 'swim', [scored(1, 99)])],
				[parsed('Swim', { min_points: 5, max_points: 20 })]
			);

			expect(diff.clampedScores[0].title).toBe('Swim');
		});

		it('lists clamped scores in pasted order, then claim order', () => {
			const diff = diffReimport(
				[
					existing(1, 'Second', [scored(10, 99)]),
					existing(2, 'First', [scored(20, 99), scored(21, 0, 2)])
				],
				[parsed('First', { position: 0 }), parsed('Second', { position: 1 })]
			);

			expect(diff.clampedScores.map((score) => score.claimId)).toEqual([20, 21, 10]);
		});
	});

	it('matches only one of two existing challenges whose titles share a key and deletes the other', () => {
		const diff = diffReimport(
			[existing(1, 'Swim  fast'), existing(2, 'Swim fast')],
			[parsed('Swim fast')]
		);

		expect(diff.matched.map((m) => m.id)).toEqual([1]);
		expect(diff.deleted).toEqual([{ id: 2, title: 'Swim fast' }]);
	});

	it('rejects a pasted list with duplicate titles, which the parser should have refused', () => {
		expect(() => diffReimport([], [parsed('Swim'), parsed(' swim ')])).toThrow(/Duplicate title/);
	});
});
