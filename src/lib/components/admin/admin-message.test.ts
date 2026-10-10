import { describe, expect, it } from 'vitest';
import { adminFailureMessage, needsRetry } from './admin-message.js';

describe('adminFailureMessage', () => {
	it('is null when the action succeeded', () => {
		expect(
			adminFailureMessage({ type: 'success', status: 200, location: '/a/x', data: {} }, 'judge')
		).toBeNull();
	});

	it('shows the server message under the given key', () => {
		expect(
			adminFailureMessage(
				{
					type: 'failure',
					status: 409,
					location: '/a/x',
					data: { judge: { kind: 'error', message: 'Sam already scored this: 15 points.' } }
				},
				'judge'
			)
		).toBe('Sam already scored this: 15 points.');
	});

	it('has no message for a failure the form shows field by field', () => {
		expect(
			adminFailureMessage(
				{
					type: 'failure',
					status: 400,
					location: '/a/x',
					data: { teamScores: { kind: 'adjustment-invalid', errors: {} } }
				},
				'teamScores'
			)
		).toBeNull();
	});

	it('says the admin link stopped working when the token was rotated', () => {
		expect(
			adminFailureMessage(
				{ type: 'error', status: 404, error: { message: 'Not found', status: 404 } },
				'judge'
			)
		).toBe('This admin link does not work any more. Ask a fellow admin for the current link.');
	});

	it('asks to try again when the request failed', () => {
		expect(
			adminFailureMessage(
				{ type: 'error', error: { message: 'fetch failed', status: 500 } },
				'judge'
			)
		).toBe('This did not go through. Check your connection and try again.');
	});

	it('asks to try again on a failure without a known shape', () => {
		expect(
			adminFailureMessage({ type: 'failure', status: 500, location: '/a/x', data: {} }, 'judge')
		).toBe('This did not go through. Check your connection and try again.');
	});
});

describe('needsRetry', () => {
	it('is true for a request that got no answer', () => {
		expect(needsRetry({ type: 'error', error: { message: 'fetch failed', status: 500 } })).toBe(
			true
		);
	});

	it('is false when the admin link stopped working', () => {
		expect(
			needsRetry({ type: 'error', status: 404, error: { message: 'Not found', status: 404 } })
		).toBe(false);
	});

	it('is false for an answer the form shows', () => {
		expect(needsRetry({ type: 'success', status: 200, location: '/a/x', data: {} })).toBe(false);
		expect(
			needsRetry({
				type: 'failure',
				status: 400,
				location: '/a/x',
				data: { settings: { kind: 'invalid', errors: {} } }
			})
		).toBe(false);
	});
});
