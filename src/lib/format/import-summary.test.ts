import { describe, expect, it } from 'vitest';
import type { ImportPreview, ImportPreviewRow } from '#lib/domain/challenge-import.js';
import { importSummary } from './import-summary.js';

function row(change: ImportPreviewRow['change']): ImportPreviewRow {
	return { title: 'A', description: null, section: null, min_points: 5, max_points: 5, change };
}

function preview(overrides: Partial<ImportPreview>): ImportPreview {
	return {
		rows: [row('unchanged')],
		errors: [],
		deleted: [],
		deletedWithClaims: [],
		clampedScores: [],
		reordered: false,
		...overrides
	};
}

describe('importSummary', () => {
	it('counts each kind of change in challenges', () => {
		const deletedWithClaims = [{ id: 1, title: 'B', claimCount: 2 }];
		expect(
			importSummary(
				preview({
					rows: [row('new'), row('new'), row('updated'), row('unchanged')],
					deleted: Array.from({ length: 19 }, () => 'C'),
					deletedWithClaims,
					reordered: true
				})
			)
		).toBe('2 new challenges, 1 challenge updated, 20 challenges deleted, a new order.');
	});

	it('says when nothing changes', () => {
		expect(importSummary(preview({}))).toBe('No changes.');
	});

	it('has nothing to say about an empty list', () => {
		expect(importSummary(preview({ rows: [] }))).toBeNull();
	});
});
