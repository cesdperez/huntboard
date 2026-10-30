import { expect, it } from 'vitest';
import {
	TEAM_MEMBERS_MAX_LENGTH,
	TEAM_NAME_MAX_LENGTH,
	normalizeTeamMembers,
	normalizeTeamName,
	teamNameError,
	teamNameKey
} from './team-name.js';

const COMPOSED = 'Caf\u00e9';
const DECOMPOSED = 'Cafe\u0301';

it('limits a team name to its maximum length', () => {
	expect(normalizeTeamName(' Canal Rats ')).toBe('Canal Rats');
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH))).toHaveLength(TEAM_NAME_MAX_LENGTH);
	expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBeNull();
});

it('stores a name composed and without invisible characters, so look-alikes are one name', () => {
	expect(normalizeTeamName(DECOMPOSED)).toBe(COMPOSED);
	expect(normalizeTeamName('Caf\u200be')).toBe('Cafe');
	expect(normalizeTeamName('\ufeffCanal\u2060 Rats\u200d')).toBe('Canal Rats');
	expect(normalizeTeamName('Cafe\u200b\u0301')).toBe(COMPOSED);
});

it('keeps the joiners that build one emoji', () => {
	const family = '\u{1f468}\u200d\u{1f469}\u200d\u{1f467}';
	const coder = '\u{1f469}\u{1f3fd}\u200d\u{1f4bb}';
	const scotland = '\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}';

	expect(normalizeTeamName(`${family} ${coder} ${scotland} Rats`)).toBe(
		`${family} ${coder} ${scotland} Rats`
	);
});

it('gives look-alike names one key', () => {
	const key = teamNameKey(COMPOSED);

	expect(teamNameKey(DECOMPOSED)).toBe(key);
	expect(teamNameKey('Caf\u200b\u00e9')).toBe(key);
	expect(teamNameKey(' CAF\u00c9 ')).toBe(key);
});

it('keys an ASCII name as SQLite lower() did, so keys stored before stay valid', () => {
	expect(teamNameKey('Canal RATS 42')).toBe('canal rats 42');
});

it('says a blank team name is missing', () => {
	expect(teamNameError('   ')).toBe('Give the team a name.');
	expect(teamNameError(null)).toBe('Give the team a name.');
	expect(teamNameError(' \u200b\ufeff ')).toBe('Give the team a name.');
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
