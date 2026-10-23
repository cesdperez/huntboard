import { isActionFailure } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { error, respond } from './action-outcome.js';

describe('respond', () => {
	it('puts a success under the key', () => {
		expect(respond('judge', { status: 200, result: { kind: 'rejected' } })).toEqual({
			judge: { kind: 'rejected' }
		});
	});

	it('fails with the status and the result under the key', () => {
		const response = respond('judge', error(409, 'Taken'));

		expect(isActionFailure(response)).toBe(true);
		expect(response).toEqual(
			expect.objectContaining({
				status: 409,
				data: { judge: { kind: 'error', message: 'Taken' } }
			})
		);
	});
});
