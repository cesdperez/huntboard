import { describe, expect, it } from 'vitest';
import { clampPoints, parsePoints, quickPointValues } from './points.js';

describe('clampPoints', () => {
	const range = { min: 5, max: 20 };

	it('keeps a value inside the range', () => {
		expect(clampPoints(12, range)).toBe(12);
	});

	it('keeps the range bounds themselves', () => {
		expect(clampPoints(5, range)).toBe(5);
		expect(clampPoints(20, range)).toBe(20);
	});

	it('raises a value below min to min', () => {
		expect(clampPoints(1, range)).toBe(5);
		expect(clampPoints(-3, range)).toBe(5);
	});

	it('lowers a value above max to max', () => {
		expect(clampPoints(99, range)).toBe(20);
	});

	it('returns the single value of a range where min equals max', () => {
		expect(clampPoints(0, { min: 10, max: 10 })).toBe(10);
		expect(clampPoints(50, { min: 10, max: 10 })).toBe(10);
	});

	it('rejects fractional points', () => {
		expect(() => clampPoints(7.5, range)).toThrow(RangeError);
	});

	it('rejects values that are not finite numbers', () => {
		expect(() => clampPoints(Number.NaN, range)).toThrow(RangeError);
		expect(() => clampPoints(Number.POSITIVE_INFINITY, range)).toThrow(RangeError);
	});

	it('rejects a range where min is greater than max', () => {
		expect(() => clampPoints(10, { min: 20, max: 5 })).toThrow(RangeError);
	});
});

describe('quickPointValues', () => {
	it('returns min, middle and max', () => {
		expect(quickPointValues({ min: 0, max: 20 })).toEqual([0, 10, 20]);
	});

	it('rounds the middle down when the range has an odd width', () => {
		expect(quickPointValues({ min: 5, max: 20 })).toEqual([5, 12, 20]);
	});

	it('returns one value when min equals max', () => {
		expect(quickPointValues({ min: 10, max: 10 })).toEqual([10]);
	});

	it('drops the middle when it equals min in a range of two', () => {
		expect(quickPointValues({ min: 5, max: 6 })).toEqual([5, 6]);
	});

	it('keeps three values in a range of three', () => {
		expect(quickPointValues({ min: 5, max: 7 })).toEqual([5, 6, 7]);
	});

	it('rejects a range where min is greater than max', () => {
		expect(() => quickPointValues({ min: 20, max: 5 })).toThrow(RangeError);
	});
});

describe('parsePoints', () => {
	it('reads a whole number, ignoring surrounding spaces', () => {
		expect(parsePoints(' 15 ')).toBe(15);
	});

	it('reads zero and negative numbers, so clamping can raise them', () => {
		expect(parsePoints('0')).toBe(0);
		expect(parsePoints('-3')).toBe(-3);
	});

	it.each(['', '  ', '7.5', '1e3', 'ten', '12abc', '+'])('refuses %j', (value) => {
		expect(parsePoints(value)).toBeNull();
	});

	it('refuses a number too large to be exact', () => {
		expect(parsePoints('99999999999999999999')).toBeNull();
	});
});
