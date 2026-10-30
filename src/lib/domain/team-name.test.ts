import { expect, it } from 'vitest';
import {
	TEAM_MEMBERS_MAX_LENGTH,
	TEAM_NAME_MAX_LENGTH,
	normalizeTeamMembers,
	normalizeTeamName,
	teamNameError
} from './team-name.js';

it('limits a team name to its maximum length', () => {
	expect(normalizeTeamName(' Canal Rats ')).toBe('Canal Rats');
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH))).toHaveLength(TEAM_NAME_MAX_LENGTH);
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBeNull();
});

it('says a blank team name is missing', () => {
	expect(teamNameError('   ')).toBe('Give the team a name.');
	expect(teamNameError(null)).toBe('Give the team a name.');
});

it('says a long team name is too long', () => {
	expect(teamNameError('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBe(
		`Keep the team name to at most ${TEAM_NAME_MAX_LENGTH} characters.`
	);
});

it('accepts team members that are blank or at most the maximum length', () => {
	expect(normalizeTeamMembers('  César,   Kos ')).toBe('César, Kos');
	expect(normalizeTeamMembers('   ')).toBe('');
	expect(normalizeTeamMembers(null)).toBe('');
	expect(normalizeTeamMembers('a'.repeat(TEAM_MEMBERS_MAX_LENGTH))).toHaveLength(
		TEAM_MEMBERS_MAX_LENGTH
	);
	expect(normalizeTeamMembers('a'.repeat(TEAM_MEMBERS_MAX_LENGTH + 1))).toBeNull();
});
