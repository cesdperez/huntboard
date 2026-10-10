import { describe, expect, it } from 'vitest';
import { countdown, formatCountdown } from './countdown.js';

const window = { startsAt: '2026-06-01T16:00:00.000Z', endsAt: '2026-06-01T21:00:00.000Z' };
const at = (iso: string) => new Date(iso);

describe('countdown', () => {
	it('counts down to the start before the game', () => {
		expect(countdown(window, at('2026-06-01T15:30:00.000Z'))).toEqual({
			kind: 'starts',
			ms: 30 * 60_000
		});
	});

	it('counts down to the end while the game runs', () => {
		expect(countdown(window, at('2026-06-01T16:00:00.000Z'))).toEqual({
			kind: 'ends',
			ms: 5 * 60 * 60_000
		});
	});

	it('has ended at the exact end time', () => {
		expect(countdown(window, at('2026-06-01T21:00:00.000Z'))).toEqual({ kind: 'ended' });
	});

	it('is unscheduled while either time is missing', () => {
		const now = at('2026-06-01T18:00:00.000Z');

		expect(countdown({ ...window, startsAt: null }, now)).toEqual({ kind: 'unscheduled' });
		expect(countdown({ ...window, endsAt: null }, now)).toEqual({ kind: 'unscheduled' });
	});
});

describe('formatCountdown', () => {
	it('shows hours, minutes and seconds', () => {
		expect(formatCountdown((1 * 3600 + 42 * 60 + 10) * 1000)).toBe('1:42:10');
	});

	it('keeps the hour under one hour so the width stays the same', () => {
		expect(formatCountdown((5 * 60 + 3) * 1000)).toBe('0:05:03');
	});

	it('goes past 24 hours instead of wrapping', () => {
		expect(formatCountdown(26 * 3600 * 1000)).toBe('26:00:00');
	});

	it('rounds a partial second up, so it reads 0:00:00 only at the moment itself', () => {
		expect(formatCountdown(1)).toBe('0:00:01');
		expect(formatCountdown(59_001)).toBe('0:01:00');
	});

	it('never goes below zero', () => {
		expect(formatCountdown(0)).toBe('0:00:00');
		expect(formatCountdown(-5000)).toBe('0:00:00');
	});
});
