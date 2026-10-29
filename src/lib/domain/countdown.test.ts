import { describe, expect, it } from 'vitest';
import { countdown, countdownLine, formatCountdown } from './countdown.js';

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
		expect(countdown(window, at('2026-06-01T21:00:00.000Z'))).toEqual({
			kind: 'ended',
			endsAt: window.endsAt
		});
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

	it('shows days once a day or more remains', () => {
		expect(formatCountdown(24 * 3600 * 1000)).toBe('1 day 0:00:00');
		expect(formatCountdown(26 * 3600 * 1000)).toBe('1 day 2:00:00');
		expect(formatCountdown((3579 * 3600 + 17 * 60 + 23) * 1000)).toBe('149 days 3:17:23');
	});

	it('keeps hours alone just under a day', () => {
		expect(formatCountdown((24 * 3600 - 1) * 1000)).toBe('23:59:59');
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

describe('countdownLine', () => {
	const formatTime = (iso: string) => `<${iso.slice(11, 16)}>`;

	it('counts down to the start', () => {
		expect(countdownLine(window, at('2026-06-01T15:00:00.000Z'), formatTime)).toBe(
			'Starts in 1:00:00'
		);
	});

	it('counts down to the end', () => {
		expect(countdownLine(window, at('2026-06-01T19:17:50.000Z'), formatTime)).toBe(
			'Ends in 1:42:10'
		);
	});

	it('says when the game ended', () => {
		expect(countdownLine(window, at('2026-06-01T22:00:00.000Z'), formatTime)).toBe(
			'Ended at <21:00>'
		);
	});

	it('says the start time is not set', () => {
		expect(
			countdownLine({ startsAt: null, endsAt: null }, at('2026-06-01T22:00:00.000Z'), formatTime)
		).toBe('Start time not set yet');
	});

	it('says the end time is not set when only the start is set', () => {
		expect(
			countdownLine({ ...window, endsAt: null }, at('2026-06-01T22:00:00.000Z'), formatTime)
		).toBe('End time not set yet');
	});
});
