import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDay } from './clock-time.js';

const amsterdam = { locale: 'en-GB', timeZone: 'Europe/Amsterdam' };

describe('formatClockTime', () => {
	it('shows only the time on the same day in the viewer time zone', () => {
		expect(
			formatClockTime('2026-06-01T19:00:00.000Z', new Date('2026-06-01T12:00:00.000Z'), amsterdam)
		).toBe('21:00');
	});

	it('uses the same day as the viewer sees it, not as UTC sees it', () => {
		expect(
			formatClockTime('2026-06-01T22:30:00.000Z', new Date('2026-06-02T08:00:00.000Z'), amsterdam)
		).toBe('00:30');
	});

	it('adds the day when the time is on another day', () => {
		expect(
			formatClockTime('2026-06-01T19:00:00.000Z', new Date('2026-05-30T12:00:00.000Z'), amsterdam)
		).toBe('Mon 1 Jun, 21:00');
	});

	it('follows a 12-hour locale', () => {
		expect(
			formatClockTime('2026-06-01T19:00:00.000Z', new Date('2026-06-01T12:00:00.000Z'), {
				locale: 'en-US',
				timeZone: 'UTC'
			})
		).toBe('7:00 PM');
	});
});

describe('formatDay', () => {
	it('shows the day and month in the viewer time zone', () => {
		expect(
			formatDay('2026-10-23T22:30:00.000Z', new Date('2026-10-20T12:00:00.000Z'), amsterdam)
		).toBe('24 October');
	});

	it('adds the year when it is not the current one', () => {
		expect(
			formatDay('2027-01-02T12:00:00.000Z', new Date('2026-12-30T12:00:00.000Z'), amsterdam)
		).toBe('2 January 2027');
	});

	it('follows the locale order', () => {
		expect(
			formatDay('2026-10-24T12:00:00.000Z', new Date('2026-10-20T12:00:00.000Z'), {
				locale: 'en-US',
				timeZone: 'UTC'
			})
		).toBe('October 24');
	});
});
