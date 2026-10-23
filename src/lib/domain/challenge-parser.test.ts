import { describe, expect, it } from 'vitest';
import {
	NO_POINTS,
	parseChallenges,
	titleKey,
	WRONG_HEADING,
	WRONG_MARKER
} from './challenge-parser.js';
import { CHALLENGE_MAX_POINTS } from './points.js';

function only(text: string) {
	const result = parseChallenges(text);
	expect(result.errors).toEqual([]);
	expect(result.challenges).toHaveLength(1);
	return result.challenges[0];
}

function errorsOf(text: string) {
	return parseChallenges(text).errors;
}

describe('parseChallenges', () => {
	it('parses the example from the challenge format doc', () => {
		const text = [
			'# Around town',
			'',
			'- Make a birthday card [5-20]',
			'  Judged on effort. A napkin counts, but barely.',
			'- Pick up a free item from Marktplaats and deliver it by bike [30-100]',
			'  Bigger and more awkward scores higher.',
			'- Swim in a fountain [25]',
			'',
			'# Food',
			'',
			'- Get a free dessert from a restaurant [10-15]',
			'- Eat something you have never tried [5-10]'
		].join('\n');

		expect(parseChallenges(text)).toEqual({
			errors: [],
			challenges: [
				{
					title: 'Make a birthday card',
					description: 'Judged on effort. A napkin counts, but barely.',
					section: 'Around town',
					min_points: 5,
					max_points: 20,
					position: 0
				},
				{
					title: 'Pick up a free item from Marktplaats and deliver it by bike',
					description: 'Bigger and more awkward scores higher.',
					section: 'Around town',
					min_points: 30,
					max_points: 100,
					position: 1
				},
				{
					title: 'Swim in a fountain',
					description: null,
					section: 'Around town',
					min_points: 25,
					max_points: 25,
					position: 2
				},
				{
					title: 'Get a free dessert from a restaurant',
					description: null,
					section: 'Food',
					min_points: 10,
					max_points: 15,
					position: 3
				},
				{
					title: 'Eat something you have never tried',
					description: null,
					section: 'Food',
					min_points: 5,
					max_points: 10,
					position: 4
				}
			]
		});
	});

	it('returns nothing for empty or blank input', () => {
		expect(parseChallenges('')).toEqual({ challenges: [], errors: [] });
		expect(parseChallenges('\n   \n\t\n')).toEqual({ challenges: [], errors: [] });
	});

	describe('list markers', () => {
		it.each([['- Swim [25]'], ['  - Swim [25]']])('accepts %j', (line) => {
			expect(only(line)).toMatchObject({ title: 'Swim', min_points: 25, max_points: 25 });
		});

		it.each([['* Swim [25]'], ['+ Swim [25]'], ['1. Swim [25]'], ['12) Swim [25]']])(
			'asks for a dash instead of %j',
			(line) => {
				expect(errorsOf(line)).toEqual([{ line: 1, message: WRONG_MARKER }]);
			}
		);

		it('asks for a dash when another marker follows a challenge at the same indent', () => {
			expect(errorsOf('- Swim [25]\n* Run [5]')).toEqual([{ line: 2, message: WRONG_MARKER }]);
		});

		it.each([['-Swim [25]'], ['– Swim [25]'], ['— Swim [25]']])(
			'asks for a dash and a space instead of %j',
			(line) => {
				expect(errorsOf(line)).toEqual([{ line: 1, message: WRONG_MARKER }]);
			}
		);

		it.each([['-Run [5]'], ['– Run [5]']])(
			'asks for a dash and a space when %j follows a challenge',
			(line) => {
				expect(errorsOf(`- Swim [25]\n${line}`)).toEqual([{ line: 2, message: WRONG_MARKER }]);
			}
		);

		it('keeps a dash line without points as description', () => {
			expect(only('- Swim [25]\n-wet').description).toBe('-wet');
		});
	});

	describe('points', () => {
		it.each([
			['- Swim [5-20]', 5, 20],
			['- Swim [10]', 10, 10],
			['- Swim [5 - 20]', 5, 20],
			['- Swim [5–20]', 5, 20],
			['- Swim [ 10 ]', 10, 10],
			['- Swim [0]', 0, 0],
			['- Swim [0-5]', 0, 5],
			['- Swim [5-20]   ', 5, 20]
		])('reads %j as %i to %i', (line, min, max) => {
			expect(only(line)).toMatchObject({ title: 'Swim', min_points: min, max_points: max });
		});

		it.each([
			['- Swim (5-20)'],
			['- Swim (10)'],
			['- Swim 5-20 pts'],
			['- Swim 10 points'],
			['- Swim: 5-20'],
			['- Swim [5-20 pts]'],
			['- Drive along Route 66'],
			['- Meet at 12:30']
		])('reports %j as having no points', (line) => {
			expect(errorsOf(line)).toEqual([{ line: 1, message: NO_POINTS }]);
		});

		it('strips separators left between title and points', () => {
			expect(only('- Swim - [10]').title).toBe('Swim');
			expect(only('- Swim: [10]').title).toBe('Swim');
		});

		it('only reads points at the end of the line', () => {
			expect(only('- Visit 3 shops [10]').title).toBe('Visit 3 shops');
			expect(only('- Take [2] photos [5-10]')).toMatchObject({
				title: 'Take [2] photos',
				min_points: 5,
				max_points: 10
			});
		});

		it('reports a challenge without points', () => {
			expect(parseChallenges('- Swim in a fountain')).toEqual({
				challenges: [],
				errors: [{ line: 1, message: NO_POINTS }]
			});
		});

		it('reports min greater than max', () => {
			expect(errorsOf('- Swim [20-5]')).toEqual([{ line: 1, message: 'Min is greater than max' }]);
		});

		it('reports fractional points', () => {
			expect(errorsOf('- Swim [2.5]')).toEqual([
				{ line: 1, message: 'Points must be whole numbers' }
			]);
		});

		it('reports points too large to store exactly', () => {
			expect(errorsOf('- Swim [99999999999999999999]')).toEqual([
				{ line: 1, message: 'Points are too large' }
			]);
		});

		it('accepts points up to the cap', () => {
			expect(only(`- Swim [0-${CHALLENGE_MAX_POINTS}]`).max_points).toBe(CHALLENGE_MAX_POINTS);
		});

		it('reports points above the cap', () => {
			expect(errorsOf(`- Swim [${CHALLENGE_MAX_POINTS + 1}]`)).toEqual([
				{ line: 1, message: 'Points are too large' }
			]);
		});

		it('reports a challenge with points but no title', () => {
			expect(errorsOf('- [10]')).toEqual([{ line: 1, message: 'No title found' }]);
		});

		it('ignores an empty list item like a blank line', () => {
			const result = parseChallenges('- Swim [25]\n-   \n  Wet.');
			expect(result.errors).toEqual([]);
			expect(result.challenges).toEqual([
				expect.objectContaining({ title: 'Swim', description: 'Wet.' })
			]);
		});
	});

	describe('titles', () => {
		it('collapses repeated whitespace', () => {
			expect(only('-   Swim   in\ta fountain   [25]').title).toBe('Swim in a fountain');
		});

		it('handles Windows line endings and a byte order mark', () => {
			const result = parseChallenges('﻿- Swim [25]\r\n  Wet.\r\n- Run [5]\r\n');
			expect(result.errors).toEqual([]);
			expect(result.challenges.map((c) => [c.title, c.description])).toEqual([
				['Swim', 'Wet.'],
				['Run', null]
			]);
		});
	});

	describe('descriptions', () => {
		it('joins several lines, indented or plain, and skips blank lines', () => {
			const text = ['- Swim [25]', '  First line.', 'Second line.', '', '    Third line.'].join(
				'\n'
			);
			expect(only(text).description).toBe('First line.\nSecond line.\nThird line.');
		});

		it('ends at the next list item', () => {
			const result = parseChallenges('- Swim [25]\n  Wet.\n- Run [5]');
			expect(result.challenges.map((c) => c.description)).toEqual(['Wet.', null]);
		});

		it('ends at a heading', () => {
			const result = parseChallenges('- Swim [25]\n  Wet.\n# Food\nTasty.');
			expect(result.challenges[0].description).toBe('Wet.');
			expect(result.errors).toEqual([
				{ line: 4, message: expect.stringMatching(/not under a challenge/i) }
			]);
		});

		it('keeps list items indented under a challenge as description', () => {
			const text = ['- Make a card [5-20]', '  - effort', '  1. creativity', '- Swim [25]'].join(
				'\n'
			);
			const result = parseChallenges(text);
			expect(result.errors).toEqual([]);
			expect(result.challenges.map((c) => [c.title, c.description])).toEqual([
				['Make a card', '- effort\n1. creativity'],
				['Swim', null]
			]);
		});

		it('treats a list item at the same indent as a new challenge', () => {
			const result = parseChallenges('  - Swim [25]\n  - Run [5]');
			expect(result.challenges.map((c) => c.title)).toEqual(['Swim', 'Run']);
		});

		it('measures tab indentation', () => {
			const result = parseChallenges('- Make a card [5-20]\n\t- effort');
			expect(result.challenges[0].description).toBe('- effort');
		});

		it('swallows description lines under a challenge that failed to parse', () => {
			expect(errorsOf('- Swim\n  Wet.\n- Run [5]')).toEqual([{ line: 1, message: NO_POINTS }]);
		});

		it('reports text before the first challenge', () => {
			expect(parseChallenges('Our hunt!\n- Swim [25]')).toEqual({
				challenges: [expect.objectContaining({ title: 'Swim' })],
				errors: [{ line: 1, message: expect.stringMatching(/not under a challenge/i) }]
			});
		});
	});

	describe('sections', () => {
		it('reads a single # as a section', () => {
			const text = ['# Food', '- Eat [5]', '#   Open  water ', '- Swim [25]'].join('\n');
			expect(parseChallenges(text).challenges.map((c) => c.section)).toEqual([
				'Food',
				'Open water'
			]);
		});

		it('asks for a single # instead of a deeper heading', () => {
			expect(errorsOf('## Food\n- Eat [5]')).toEqual([{ line: 1, message: WRONG_HEADING }]);
		});

		it('has no section before the first heading', () => {
			const result = parseChallenges('- Run [5]\n# Food\n- Eat [5]');
			expect(result.challenges.map((c) => c.section)).toEqual([null, 'Food']);
		});

		it('clears the section on an empty heading', () => {
			const result = parseChallenges('# Food\n- Eat [5]\n#\n- Run [5]');
			expect(result.challenges.map((c) => c.section)).toEqual(['Food', null]);
		});

		it('needs a space after the hashes', () => {
			expect(errorsOf('#Food')).toEqual([
				{ line: 1, message: expect.stringMatching(/not under a challenge/i) }
			]);
		});
	});

	it('numbers positions over accepted challenges only', () => {
		const result = parseChallenges('- Swim [25]\n- Broken\n- Run [5]');
		expect(result.challenges.map((c) => [c.title, c.position])).toEqual([
			['Swim', 0],
			['Run', 1]
		]);
	});

	it('reports every error with its own line number', () => {
		const text = ['# Food', '- Eat', '', '- Drink [5-1]', '- Swim [25]', '- [3]'].join('\n');
		expect(parseChallenges(text).errors).toEqual([
			{ line: 2, message: NO_POINTS },
			{ line: 4, message: 'Min is greater than max' },
			{ line: 6, message: 'No title found' }
		]);
	});

	describe('duplicate titles', () => {
		it('reports a title that repeats ignoring case and spacing, keeping the first', () => {
			const text = ['- Swim in a fountain [25]', '# Other', '-   SWIM  in a Fountain [5]'].join(
				'\n'
			);
			expect(parseChallenges(text)).toEqual({
				challenges: [expect.objectContaining({ title: 'Swim in a fountain', position: 0 })],
				errors: [{ line: 3, message: 'Duplicate title "SWIM in a Fountain" (first on line 1)' }]
			});
		});

		it('treats titles that differ in more than case and spacing as different', () => {
			expect(parseChallenges('- Swim [25]\n- Swim twice [25]').errors).toEqual([]);
		});
	});
});

describe('titleKey', () => {
	it('ignores case and surrounding or repeated spaces', () => {
		expect(titleKey('  Swim  in A Fountain ')).toBe(titleKey('swim in a fountain'));
	});
});
