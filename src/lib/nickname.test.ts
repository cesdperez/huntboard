import { expect, it } from 'vitest';
import { NICKNAME_MAX_LENGTH, normalizeNickname } from './nickname.js';

it('limits a nickname to its maximum length', () => {
	expect(normalizeNickname(' Sam ')).toBe('Sam');
	expect(normalizeNickname('a'.repeat(NICKNAME_MAX_LENGTH))).toHaveLength(NICKNAME_MAX_LENGTH);
	expect(normalizeNickname('a'.repeat(NICKNAME_MAX_LENGTH + 1))).toBeNull();
});
