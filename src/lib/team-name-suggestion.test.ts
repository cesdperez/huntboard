import { expect, it } from 'vitest';
import { TEAM_NAME_MAX_LENGTH } from './team-name.js';
import { suggestTeamName, TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from './team-name-suggestion.js';

const sequence = (...values: number[]) => {
	let index = 0;
	return () => values[index++ % values.length];
};

it('joins an adjective and a noun picked by the random source', () => {
	expect(suggestTeamName([], sequence(0, 0))).toBe(
		`${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`
	);
	expect(suggestTeamName([], sequence(0.999, 0.999))).toBe(
		`${TEAM_NAME_ADJECTIVES.at(-1)} ${TEAM_NAME_NOUNS.at(-1)}`
	);
});

it('skips a name already taken, ignoring case', () => {
	const taken = `${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`.toUpperCase();
	expect(suggestTeamName([taken], sequence(0, 0, 0, 0.999))).toBe(
		`${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS.at(-1)}`
	);
});

it('still suggests a name when the random picks keep hitting taken names', () => {
	const taken = `${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`;
	expect(suggestTeamName([taken], sequence(0))).toBe(taken);
});

it('only uses unique words that fit a team name', () => {
	for (const words of [TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS]) {
		expect(new Set(words).size).toBe(words.length);
	}
	const longest = (words: readonly string[]) => Math.max(...words.map((word) => word.length));
	expect(longest(TEAM_NAME_ADJECTIVES) + 1 + longest(TEAM_NAME_NOUNS)).toBeLessThanOrEqual(
		TEAM_NAME_MAX_LENGTH
	);
});
