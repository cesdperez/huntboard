import { describe, expect, it } from 'vitest';
import { normalizeName } from './name.js';

describe('normalizeName', () => {
	it('trims and collapses spaces', () => {
		expect(normalizeName('  Canal   Rats ', 40)).toBe('Canal Rats');
	});

	it.each([
		['empty', ''],
		['only spaces', '   '],
		['missing', null],
		['a file upload', new Blob(['Canal Rats'])]
	])('rejects %s', (_, value) => {
		expect(normalizeName(value, 40)).toBeNull();
	});

	it('accepts the maximum length and rejects one more', () => {
		expect(normalizeName('a'.repeat(5), 5)).toBe('aaaaa');
		expect(normalizeName('a'.repeat(6), 5)).toBeNull();
	});
});
