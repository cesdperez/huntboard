import { describe, expect, it } from 'vitest';
import { gamePhase } from './game-window.js';

const window = { startsAt: '2026-06-01T16:00:00.000Z', endsAt: '2026-06-01T21:00:00.000Z' };
const at = (iso: string) => new Date(iso);

describe('gamePhase', () => {
	it('is before when now is earlier than the start', () => {
		expect(gamePhase(window, at('2026-06-01T15:59:59.999Z'))).toBe('before');
	});

	it('is during at the exact start time (start is inclusive)', () => {
		expect(gamePhase(window, at('2026-06-01T16:00:00.000Z'))).toBe('during');
	});

	it('is during between start and end', () => {
		expect(gamePhase(window, at('2026-06-01T18:30:00.000Z'))).toBe('during');
	});

	it('is during one millisecond before the end', () => {
		expect(gamePhase(window, at('2026-06-01T20:59:59.999Z'))).toBe('during');
	});

	it('is after at the exact end time (end is exclusive)', () => {
		expect(gamePhase(window, at('2026-06-01T21:00:00.000Z'))).toBe('after');
	});

	it('is after once the end has passed', () => {
		expect(gamePhase(window, at('2026-06-02T09:00:00.000Z'))).toBe('after');
	});

	it('compares instants, not wall clock text, across time zone offsets', () => {
		expect(gamePhase(window, at('2026-06-01T17:30:00.000+02:00'))).toBe('before');
	});

	it('is before when the start is not set, because the game is not scheduled', () => {
		expect(gamePhase({ ...window, startsAt: null }, at('2026-06-01T18:00:00.000Z'))).toBe('before');
	});

	it('is before when the end is not set, because the game is not scheduled', () => {
		expect(gamePhase({ ...window, endsAt: null }, at('2026-06-01T22:00:00.000Z'))).toBe('before');
	});

	it('is before when neither time is set', () => {
		expect(gamePhase({ startsAt: null, endsAt: null }, at('2026-06-01T18:00:00.000Z'))).toBe(
			'before'
		);
	});

	it('treats an empty time string as not set', () => {
		expect(gamePhase({ startsAt: '', endsAt: '' }, at('2026-06-01T18:00:00.000Z'))).toBe('before');
	});

	it('rejects a time that is not a valid date', () => {
		expect(() =>
			gamePhase({ ...window, startsAt: 'tomorrow' }, at('2026-06-01T18:00:00Z'))
		).toThrow(RangeError);
	});
});
