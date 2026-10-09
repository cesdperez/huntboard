import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localInputToUtc, utcToLocalInput } from './local-time.js';

let originalTz: string | undefined;

beforeAll(() => {
	originalTz = process.env.TZ;
	process.env.TZ = 'Europe/Amsterdam';
});

afterAll(() => {
	process.env.TZ = originalTz;
});

describe('localInputToUtc', () => {
	it('reads a datetime-local value in the browser time zone', () => {
		expect(localInputToUtc('2026-06-20T16:00')).toBe('2026-06-20T14:00:00.000Z');
	});

	it('follows the offset of the date, not of today', () => {
		expect(localInputToUtc('2026-12-20T16:00')).toBe('2026-12-20T15:00:00.000Z');
	});

	it('returns null for an empty field', () => {
		expect(localInputToUtc('')).toBeNull();
	});

	it('returns null for a value that is not a date', () => {
		expect(localInputToUtc('soon')).toBeNull();
	});
});

describe('utcToLocalInput', () => {
	it('shows a stored UTC time as the local wall clock', () => {
		expect(utcToLocalInput('2026-06-20T14:00:00.000Z')).toBe('2026-06-20T16:00');
	});

	it('crosses midnight into the local date', () => {
		expect(utcToLocalInput('2026-12-31T23:30:00.000Z')).toBe('2027-01-01T00:30');
	});

	it('returns an empty field for an unset time', () => {
		expect(utcToLocalInput(null)).toBe('');
	});

	it('round-trips through localInputToUtc', () => {
		expect(utcToLocalInput(localInputToUtc('2026-03-29T03:15'))).toBe('2026-03-29T03:15');
	});
});
