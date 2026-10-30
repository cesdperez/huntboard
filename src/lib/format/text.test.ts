import { describe, expect, it } from 'vitest';
import { collapseSpaces, isolate, splitLastWord } from './text.js';

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

describe('isolate', () => {
	it('leaves left-to-right text as it is', () => {
		expect(isolate('Canal Rats, Zoë')).toBe('Canal Rats, Zoë');
	});

	it('isolates a right-to-left override, so it cannot reverse the text around it', () => {
		expect(isolate('bb-1029 \u202egpj.exe')).toBe('\u2068bb-1029 \u202egpj.exe\u2069');
	});

	it('isolates right-to-left letters, so the punctuation after them stays in place', () => {
		expect(isolate('שועלי התעלה')).toBe('\u2068שועלי התעלה\u2069');
	});
});
