import { describe, expect, it } from 'vitest';
import { nextPath } from './account.js';

describe('nextPath', () => {
	it('keeps a path on this site', () => {
		expect(nextPath('/a/abc/setup')).toBe('/a/abc/setup');
		expect(nextPath('/new')).toBe('/new');
	});

	it.each([
		['missing', null],
		['empty', ''],
		['an absolute URL', 'https://evil.example/'],
		['a protocol-relative URL', '//evil.example/'],
		['a backslash URL', '/\\evil.example/'],
		['a relative path', 'games']
	])('goes to My games for %s', (_, value) => {
		expect(nextPath(value)).toBe('/games');
	});
});
