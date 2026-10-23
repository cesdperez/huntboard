import { describe, expect, it } from 'vitest';
import { collapseSpaces } from './text.js';

describe('collapseSpaces', () => {
	it('trims and collapses every run of whitespace into one space', () => {
		expect(collapseSpaces('  Swim \t in a\n\nfountain  ')).toBe('Swim in a fountain');
	});
});
