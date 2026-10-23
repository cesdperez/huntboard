import { describe, expect, it } from 'vitest';
import { plural } from './plural.js';

describe('plural', () => {
	it('uses the singular for exactly one', () => {
		expect(plural(1, 'claim')).toBe('1 claim');
	});

	it.each([0, 2])('adds an s for %i', (count) => {
		expect(plural(count, 'claim')).toBe(`${count} claims`);
	});

	it('takes an irregular plural', () => {
		expect(plural(3, 'match', 'matches')).toBe('3 matches');
	});
});
