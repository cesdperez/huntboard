import { describe, expect, it } from 'vitest';
import { creationCodeMatches } from './creation-code.js';

describe('creationCodeMatches', () => {
	it('accepts the exact code', async () => {
		expect(await creationCodeMatches('letmein', 'letmein')).toBe(true);
	});

	it.each([
		['a different code', 'letmeout'],
		['a prefix', 'letme'],
		['a longer code', 'letmein2'],
		['different case', 'LetMeIn'],
		['an empty code', '']
	])('rejects %s', async (_, given) => {
		expect(await creationCodeMatches(given, 'letmein')).toBe(false);
	});

	it('rejects everything when no code is configured', async () => {
		expect(await creationCodeMatches('', '')).toBe(false);
		expect(await creationCodeMatches('anything', undefined)).toBe(false);
	});
});
