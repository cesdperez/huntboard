import { describe, expect, it } from 'vitest';
import { absoluteLink } from './absolute-link.js';

describe('absoluteLink', () => {
	it('anchors a root path to the page origin', () => {
		expect(absoluteLink('/s/abc', 'https://hunt.example/a/xyz')).toBe('https://hunt.example/s/abc');
	});

	it('anchors the relative path resolve() returns during SSR to the page it was resolved for', () => {
		expect(absoluteLink('../s/abc', 'https://hunt.example/s/abc')).toBe(
			'https://hunt.example/s/abc'
		);
	});

	it("drops the page's query and hash, so nothing but the path reaches the link", () => {
		expect(absoluteLink('/s/abc', 'https://hunt.example/s/abc?t=secret#admin')).toBe(
			'https://hunt.example/s/abc'
		);
	});
});
