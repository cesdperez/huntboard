import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX_LENGTH, normalizeNickname } from './nickname.js';

describe('normalizeNickname', () => {
	it('trims and collapses spaces', () => {
		expect(normalizeNickname('  Sam   de Vries ')).toBe('Sam de Vries');
	});

	it.each([
		['empty', ''],
		['only spaces', '   '],
		['missing', null],
		['a file upload', new Blob(['Sam'])]
	])('rejects %s', (_, value) => {
		expect(normalizeNickname(value)).toBeNull();
	});

	it('accepts the maximum length and rejects one more', () => {
		expect(normalizeNickname('a'.repeat(NICKNAME_MAX_LENGTH))).toHaveLength(NICKNAME_MAX_LENGTH);
		expect(normalizeNickname('a'.repeat(NICKNAME_MAX_LENGTH + 1))).toBeNull();
	});
});
