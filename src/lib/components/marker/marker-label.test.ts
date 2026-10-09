import { describe, expect, it } from 'vitest';
import { markerLabel } from './marker-label.js';

describe('markerLabel', () => {
	it('names the open, pending and rejected states', () => {
		expect(markerLabel('open')).toBe('Open');
		expect(markerLabel('pending')).toBe('Pending');
		expect(markerLabel('rejected')).toBe('Rejected');
	});

	it('includes the awarded points when scored', () => {
		expect(markerLabel('scored', 15)).toBe('Scored 15 points');
	});

	it('uses the singular for one point', () => {
		expect(markerLabel('scored', 1)).toBe('Scored 1 point');
	});

	it('scores zero points as plural', () => {
		expect(markerLabel('scored', 0)).toBe('Scored 0 points');
	});
});
