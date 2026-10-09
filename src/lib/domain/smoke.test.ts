import { describe, expect, it } from 'vitest';

describe('test setup', () => {
	it('runs domain tests in node', () => {
		expect(typeof process.versions.node).toBe('string');
	});
});
