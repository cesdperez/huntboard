import { describe, expect, it } from 'vitest';
import { nextPath, normalizeEmail } from './account.js';

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

describe('normalizeEmail', () => {
	it('trims and lowercases an address', () => {
		expect(normalizeEmail('  Sam@Example.COM ')).toBe('sam@example.com');
	});

	it.each([
		['missing', undefined],
		['empty', ''],
		['without an @', 'sam.example.com'],
		['without a dot in the domain', 'sam@localhost'],
		['with spaces inside', 'sam smith@example.com'],
		['too long', `${'a'.repeat(250)}@example.com`]
	])('refuses an address %s', (_, value) => {
		expect(normalizeEmail(value)).toBeNull();
	});
});
