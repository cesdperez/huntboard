import { describe, expect, it } from 'vitest';
import { collapseSpaces, splitLastWord } from './text.js';

describe('collapseSpaces', () => {
	it('trims and collapses every run of whitespace into one space', () => {
		expect(collapseSpaces('  Swim \t in a\n\nfountain  ')).toBe('Swim in a fountain');
	});
});

describe('splitLastWord', () => {
	it('splits a name of several words before its last word', () => {
		expect(splitLastWord('Málaga hunt')).toEqual({ head: 'Málaga', tail: 'hunt' });
		expect(splitLastWord('Lightmile Málaga scavenger hunt')).toEqual({
			head: 'Lightmile Málaga scavenger',
			tail: 'hunt'
		});
	});

	it('splits on any run of whitespace, a line break included', () => {
		expect(splitLastWord('Málaga \n hunt')).toEqual({ head: 'Málaga', tail: 'hunt' });
	});

	it('leaves a single word, or nothing, unsplit', () => {
		expect(splitLastWord('Málaga')).toBeNull();
		expect(splitLastWord(' Málaga ')).toBeNull();
		expect(splitLastWord('')).toBeNull();
	});
});
