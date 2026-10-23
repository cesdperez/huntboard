import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago.js';

const NOW = new Date('2026-06-01T18:00:00.000Z');

describe('timeAgo', () => {
	it('says just now under a minute', () => {
		expect(timeAgo('2026-06-01T17:59:00.001Z', NOW)).toBe('just now');
	});

	it('says just now for a time slightly ahead of this clock', () => {
		expect(timeAgo('2026-06-01T18:00:20.000Z', NOW)).toBe('just now');
	});

	it('counts whole minutes, rounded down', () => {
		expect(timeAgo('2026-06-01T17:59:00.000Z', NOW)).toBe('1 min ago');
		expect(timeAgo('2026-06-01T17:55:30.000Z', NOW)).toBe('4 min ago');
		expect(timeAgo('2026-06-01T17:00:00.001Z', NOW)).toBe('59 min ago');
	});

	it('counts hours and leftover minutes from an hour on', () => {
		expect(timeAgo('2026-06-01T17:00:00.000Z', NOW)).toBe('1 h ago');
		expect(timeAgo('2026-06-01T15:55:00.000Z', NOW)).toBe('2 h 5 min ago');
	});
});
