import { describe, expect, it } from 'vitest';
import { NO_POINTS, parseChallenges } from './challenge-parser.js';
import {
	buildImportPlan,
	buildImportPreview,
	unacknowledgedDeletions
} from './challenge-import.js';
import { diffReimport, type ExistingChallenge } from './reimport-diff.js';

const swimOnly: ExistingChallenge[] = [{ id: 7, title: 'swim in a FOUNTAIN', claims: [] }];

describe('buildImportPlan', () => {
	it('inserts new challenges with their title key and pasted position', () => {
		const { challenges } = parseChallenges('# Food\n- Eat a  Snack [5-10]\n  Anything counts');

		const plan = buildImportPlan(diffReimport([], challenges));

		expect(plan).toEqual({
			inserts: [
				{
					title: 'Eat a Snack',
					title_key: 'eat a snack',
					description: 'Anything counts',
					section: 'Food',
					min_points: 5,
					max_points: 10,
					position: 0
				}
			],
			updates: [],
			deleteIds: [],
			deleteWithClaimsIds: []
		});
	});

	it('updates matched challenges to the pasted title, fields and position', () => {
		const { challenges } = parseChallenges('- Run [1]\n- Swim in a fountain [10-30]');

		const plan = buildImportPlan(diffReimport(swimOnly, challenges));

		expect(plan.updates).toEqual([
			{
				id: 7,
				title: 'Swim in a fountain',
				title_key: 'swim in a fountain',
				description: null,
				section: null,
				min_points: 10,
				max_points: 30,
				position: 1
			}
		]);
		expect(plan.inserts.map((c) => c.title)).toEqual(['Run']);
	});

	it('keeps missing challenges with claims apart from those without', () => {
		const existing: ExistingChallenge[] = [
			{ id: 1, title: 'Gone', claims: [] },
			{ id: 2, title: 'Claimed', claims: [{ id: 9, team_id: 1, status: 'rejected', points: null }] }
		];

		const plan = buildImportPlan(diffReimport(existing, []));

		expect(plan.deleteIds).toEqual([1]);
		expect(plan.deleteWithClaimsIds).toEqual([2]);
	});
});

describe('unacknowledgedDeletions', () => {
	const existing: ExistingChallenge[] = [
		{
			id: 1,
			title: 'Claimed once',
			claims: [{ id: 9, team_id: 1, status: 'pending', points: null }]
		},
		{
			id: 2,
			title: 'Claimed twice',
			claims: [{ id: 8, team_id: 1, status: 'pending', points: null }]
		}
	];
	const diff = diffReimport(existing, []);

	it('lists deletions with claims the admin did not see in the preview', () => {
		expect(unacknowledgedDeletions(diff, [1])).toEqual([
			{ id: 2, title: 'Claimed twice', claimCount: 1 }
		]);
	});

	it('is empty when every deletion with claims was acknowledged', () => {
		expect(unacknowledgedDeletions(diff, [2, 1])).toEqual([]);
	});
});

describe('buildImportPreview', () => {
	it('marks each pasted challenge as new or updated, in pasted order', () => {
		const preview = buildImportPreview(
			'# Wet\n- Dive [3]\n- Swim in a fountain [25]',
			swimOnly,
			new Map()
		);

		expect(preview.rows).toEqual([
			{
				title: 'Dive',
				description: null,
				section: 'Wet',
				min_points: 3,
				max_points: 3,
				change: 'new'
			},
			{
				title: 'Swim in a fountain',
				description: null,
				section: 'Wet',
				min_points: 25,
				max_points: 25,
				change: 'updated'
			}
		]);
	});

	it('shows parse errors with the text of the offending line', () => {
		const preview = buildImportPreview('- Fine [1]\r\n- Broken line\n- Bad [9-2]', [], new Map());

		expect(preview.errors).toEqual([
			{ line: 2, message: NO_POINTS, source: '- Broken line' },
			{ line: 3, message: 'Min is greater than max', source: '- Bad [9-2]' }
		]);
	});

	it('lists deletions and clamped scores with team names', () => {
		const existing: ExistingChallenge[] = [
			{
				id: 1,
				title: 'Swim',
				claims: [
					{ id: 10, team_id: 3, status: 'scored', points: 40 },
					{ id: 11, team_id: 4, status: 'scored', points: 15 }
				]
			},
			{ id: 2, title: 'Gone', claims: [] },
			{ id: 3, title: 'Claimed', claims: [{ id: 12, team_id: 3, status: 'pending', points: null }] }
		];
		const teamNames = new Map([[3, 'Canal Rats']]);

		const preview = buildImportPreview('- Swim [10-30]', existing, teamNames);

		expect(preview.deleted).toEqual(['Gone']);
		expect(preview.deletedWithClaims).toEqual([{ id: 3, title: 'Claimed', claimCount: 1 }]);
		expect(preview.clampedScores).toEqual([
			{ title: 'Swim', teamName: 'Canal Rats', from: 40, to: 30 }
		]);
	});
});
