import { describe, expect, it } from 'vitest';
import { earlierRejectionsText } from './earlier-rejections.js';

describe('earlierRejectionsText', () => {
	it('names one rejection with its reason', () => {
		expect(earlierRejectionsText({ count: 1, lastNote: 'no proof' })).toBe(
			'Rejected once before: no proof'
		);
	});

	it('counts several rejections and ends with a full stop without a reason', () => {
		expect(earlierRejectionsText({ count: 3, lastNote: null })).toBe('Rejected 3 times before.');
	});
});
