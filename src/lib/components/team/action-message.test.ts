import { describe, expect, it } from 'vitest';
import { actionFailureMessage } from './action-message.js';

const closedMessage = (phase: string) => `closed ${phase}`;

describe('actionFailureMessage', () => {
	it('is null when the action succeeded', () => {
		expect(
			actionFailureMessage({ type: 'success', status: 200, location: '/t/x' }, closedMessage)
		).toBeNull();
	});

	it('shows the server message', () => {
		expect(
			actionFailureMessage(
				{
					type: 'failure',
					status: 409,
					location: '/t/x',
					data: { team: { kind: 'error', message: 'Kim already marked this done.' } }
				},
				closedMessage
			)
		).toBe('Kim already marked this done.');
	});

	it('builds the closed window message in the browser', () => {
		expect(
			actionFailureMessage(
				{
					type: 'failure',
					status: 403,
					location: '/t/x',
					data: { team: { kind: 'closed', phase: 'after' } }
				},
				closedMessage
			)
		).toBe('closed after');
	});

	it('says the link stopped working when the token was rotated', () => {
		expect(
			actionFailureMessage(
				{ type: 'error', status: 404, error: { message: 'Not found', status: 404 } },
				closedMessage
			)
		).toBe('This link does not work any more. Ask your organiser for the current link.');
	});

	it('asks to try again when the request failed', () => {
		expect(
			actionFailureMessage(
				{ type: 'error', error: { message: 'fetch failed', status: 500 } },
				closedMessage
			)
		).toBe('This did not go through. Check your connection and try again.');
	});
});
