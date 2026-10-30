import { describe, expect, it } from 'vitest';
import { adjustmentAdded } from './adjustment-added.js';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

const item = (id: number, points: number, reason: string) => ({
	id,
	points,
	reason,
	createdBy: 'Sam',
	createdAt: '2026-10-30T10:00:00.000Z'
});

const PENALTY = form({ sign: 'penalty', points: '7', reason: '  Late  start ' });

describe('adjustmentAdded', () => {
	it('finds a new adjustment matching what was sent', () => {
		const after = [item(1, -7, 'Late start'), item(2, -7, 'Late start')];
		expect(adjustmentAdded([1], after, PENALTY)).toBe(true);
	});

	it('ignores a matching adjustment that was there before', () => {
		expect(adjustmentAdded([1], [item(1, -7, 'Late start')], PENALTY)).toBe(false);
	});

	it('ignores a new adjustment with other points or reason', () => {
		const after = [item(2, 7, 'Late start'), item(3, -7, 'Costume')];
		expect(adjustmentAdded([], after, PENALTY)).toBe(false);
	});

	it('finds nothing for a form the server would refuse', () => {
		const refused = form({ points: 'x', reason: '' });
		expect(adjustmentAdded([], [item(2, -7, 'Late start')], refused)).toBe(false);
	});
});
