import { describe, expect, it } from 'vitest';
import { clampTypedPoints } from './clamped-points.js';

const range = { min: 10, max: 25 };

describe('clampTypedPoints', () => {
	it('lowers points above the range and says so', () => {
		expect(clampTypedPoints('99', range)).toEqual({
			value: '25',
			note: 'This challenge gives 10 to 25 points, so 99 became 25.'
		});
	});

	it('raises points below the range and says so', () => {
		expect(clampTypedPoints(' 3 ', range)).toEqual({
			value: '10',
			note: 'This challenge gives 10 to 25 points, so 3 became 10.'
		});
	});

	it('names a single value with its unit', () => {
		expect(clampTypedPoints('30', { min: 25, max: 25 })?.note).toBe(
			'This challenge gives 25 points, so 30 became 25.'
		);
	});

	it('has no note for points inside the range', () => {
		expect(clampTypedPoints('12', range)).toEqual({ value: '12', note: null });
	});

	it('leaves text that is not a whole number to the server', () => {
		expect(clampTypedPoints('ten', range)).toBeNull();
	});
});
