import { describe, expect, it } from 'vitest';
import { TEAM_NAME_MAX_LENGTH, normalizeTeamName } from './team-name.js';

describe('normalizeTeamName', () => {
	it('trims and collapses spaces', () => {
		expect(normalizeTeamName('  Canal   Rats ')).toBe('Canal Rats');
	});

	it.each([
		['empty', ''],
		['only spaces', '   '],
		['missing', null],
		['a file upload', new Blob(['Canal Rats'])]
	])('rejects %s', (_, value) => {
		expect(normalizeTeamName(value)).toBeNull();
	});

	it('accepts the maximum length and rejects one more', () => {
		expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH))).toHaveLength(TEAM_NAME_MAX_LENGTH);
		expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBeNull();
	});
});
