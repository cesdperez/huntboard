import { expect, it } from 'vitest';
import { TEAM_NAME_MAX_LENGTH, normalizeTeamName } from './team-name.js';

it('limits a team name to its maximum length', () => {
	expect(normalizeTeamName(' Canal Rats ')).toBe('Canal Rats');
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH))).toHaveLength(TEAM_NAME_MAX_LENGTH);
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBeNull();
});
