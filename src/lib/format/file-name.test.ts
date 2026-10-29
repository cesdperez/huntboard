import { describe, expect, it } from 'vitest';
import { safeFileName } from './file-name.js';

describe('safeFileName', () => {
	it('keeps an ordinary name, accents and emoji included', () => {
		expect(safeFileName('Canal Rats é 🐀', 'Team')).toBe('Canal Rats é 🐀');
	});

	it.each([
		['Rats/Owls', 'Rats Owls'],
		['C:\\temp', 'C temp'],
		['a*b?c"d<e>f|g:h', 'a b c d e f g h'],
		['line\nbreak\ttab\u0000nul\u007fdel', 'line break tab nul del'],
		['  spaced   out  ', 'spaced out'],
		['..hidden..', 'hidden'],
		['../../etc/passwd', 'etc passwd']
	])('turns %j into %j', (name, safe) => {
		expect(safeFileName(name, 'Team')).toBe(safe);
	});

	it('caps the length by characters, never splitting one', () => {
		expect(safeFileName('🐀'.repeat(100), 'Team', 10)).toBe('🐀'.repeat(10));
		expect(safeFileName(`${'a'.repeat(9)} b`, 'Team', 10)).toBe('a'.repeat(9));
	});

	it('falls back when nothing is left', () => {
		expect(safeFileName(' /.. ', 'Team')).toBe('Team');
	});
});
