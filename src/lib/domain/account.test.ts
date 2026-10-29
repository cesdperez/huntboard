import { describe, expect, it } from 'vitest';
import { nextPath, normalizeEmail, signInPath } from './account.js';

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
		['a tab browsers strip into //', '/\t/evil.example/'],
		['a newline browsers strip into //', '/\n/evil.example/'],
		['a relative path', 'games'],
		['the sign-in page, which a signed-in user would loop on', '/login'],
		['the sign-in page with a query', '/login?next=/login']
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

describe('signInPath', () => {
	it('sends to sign-in and back to the encoded path', () => {
		expect(signInPath('/a/abc/setup?x=1')).toBe('/login?next=%2Fa%2Fabc%2Fsetup%3Fx%3D1');
	});
});
