import { describe, expect, it } from 'vitest';
import { gameReadiness, gameStateLine } from './game-readiness.js';

const scheduled = { startsAt: '2026-06-01T16:00:00.000Z', endsAt: '2026-06-01T21:00:00.000Z' };
const unscheduled = { startsAt: null, endsAt: null };

describe('gameReadiness', () => {
	it('is ready with both times, a challenge and a team', () => {
		const readiness = gameReadiness(scheduled, { challenges: 10, teams: 4 });

		expect(readiness.ready).toBe(true);
		expect(readiness.checks).toEqual([
			{ key: 'times', met: true, label: 'Start and end time set' },
			{ key: 'challenges', met: true, label: '10 challenges' },
			{ key: 'teams', met: true, label: '4 teams' }
		]);
	});

	it('names what to do for each unmet check', () => {
		const readiness = gameReadiness(unscheduled, { challenges: 0, teams: 0 });

		expect(readiness.ready).toBe(false);
		expect(readiness.checks).toEqual([
			{ key: 'times', met: false, label: 'Set the start and end time' },
			{ key: 'challenges', met: false, label: 'Add challenges' },
			{ key: 'teams', met: false, label: 'Add teams' }
		]);
	});

	it('counts one in the singular', () => {
		const labels = gameReadiness(scheduled, { challenges: 1, teams: 1 }).checks.map((c) => c.label);

		expect(labels).toEqual(['Start and end time set', '1 challenge', '1 team']);
	});

	it.each([
		['only a start time', { ...scheduled, endsAt: null }, 1, 1],
		['only an end time', { ...scheduled, startsAt: null }, 1, 1],
		['no challenges', scheduled, 0, 1],
		['no teams', scheduled, 1, 0]
	])('is not ready with %s', (_case, window, challenges, teams) => {
		expect(gameReadiness(window, { challenges, teams }).ready).toBe(false);
	});
});

describe('gameStateLine', () => {
	it.each([
		['before', 'Starts in 0:42:10', 'Not started. Starts in 0:42:10'],
		['before', 'Start time not set yet', 'Not started. Start time not set yet'],
		['during', 'Ends in 1:42:10', 'Live. Ends in 1:42:10'],
		['after', 'Ended at 21:00', 'Ended at 21:00']
	] as const)('puts the %s state before "%s"', (phase, countdown, line) => {
		expect(gameStateLine(phase, countdown)).toBe(line);
	});
});
