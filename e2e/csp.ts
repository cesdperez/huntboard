import { expect, test, type Page } from '@playwright/test';

const violations: string[] = [];

/** Fails each test of the calling spec after a watched page logs a CSP violation. */
export function failOnCspViolations(): void {
	test.afterEach(() => {
		expect(violations.splice(0)).toEqual([]);
	});
}

export function watchCsp(page: Page): void {
	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) violations.push(message.text());
	});
}
