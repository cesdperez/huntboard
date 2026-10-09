import { describe, expect, it } from 'vitest';
import { validateChallengeEdit, type ChallengeEditInput } from './challenge-edit.js';

function input(overrides: Partial<ChallengeEditInput> = {}): ChallengeEditInput {
	return {
		title: 'Swim in a fountain',
		description: '',
		section: '',
		min: '5',
		max: '20',
		...overrides
	};
}

describe('validateChallengeEdit', () => {
	it('accepts a valid edit and stores the title key', () => {
		const result = validateChallengeEdit(
			input({
				title: '  Swim in a   Fountain ',
				description: 'Wet\r\nvery wet ',
				section: ' Around   town '
			})
		);

		expect(result).toEqual({
			ok: true,
			fields: {
				title: 'Swim in a Fountain',
				title_key: 'swim in a fountain',
				description: 'Wet\nvery wet',
				section: 'Around town',
				min_points: 5,
				max_points: 20
			}
		});
	});

	it('stores empty description and section as null', () => {
		const result = validateChallengeEdit(input({ description: '  ', section: '' }));

		expect(result).toMatchObject({ ok: true, fields: { description: null, section: null } });
	});

	it('requires a title', () => {
		expect(validateChallengeEdit(input({ title: '  ' }))).toEqual({
			ok: false,
			errors: { title: 'Enter a title.' }
		});
	});

	it.each(['', '-1', '2.5', 'ten', '1e3'])('rejects %j as points', (value) => {
		expect(validateChallengeEdit(input({ min: value, max: value }))).toEqual({
			ok: false,
			errors: {
				min: 'Enter a whole number, 0 or more.',
				max: 'Enter a whole number, 0 or more.'
			}
		});
	});

	it('rejects a min greater than the max', () => {
		expect(validateChallengeEdit(input({ min: '30', max: '20' }))).toEqual({
			ok: false,
			errors: { max: 'Max must be at least the min (30).' }
		});
	});

	it('accepts a single value range', () => {
		expect(validateChallengeEdit(input({ min: '25', max: '25' }))).toMatchObject({
			ok: true,
			fields: { min_points: 25, max_points: 25 }
		});
	});
});
