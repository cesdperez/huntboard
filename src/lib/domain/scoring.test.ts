import { describe, expect, it } from 'vitest';
import {
	computeScoreboard,
	latePenalty,
	minutesLate,
	rankByTotal,
	type ScoringClaim,
	type ScoringTeam
} from './scoring.js';

const ENDS_AT = '2026-06-01T19:00:00.000Z';

function team(id: number, overrides: Partial<ScoringTeam> = {}): ScoringTeam {
	return { id, name: `Team ${id}`, position: id, arrivedAt: null, ...overrides };
}

function scored(teamId: number, points: number): ScoringClaim {
	return { teamId, status: 'scored', points };
}

describe('minutesLate', () => {
	it('is 0 when the team has not arrived', () => {
		expect(minutesLate(ENDS_AT, null)).toBe(0);
	});

	it('is 0 when the game has no end time', () => {
		expect(minutesLate(null, '2026-06-01T20:00:00.000Z')).toBe(0);
	});

	it('is 0 when the team arrives before the end', () => {
		expect(minutesLate(ENDS_AT, '2026-06-01T18:30:00.000Z')).toBe(0);
	});

	it('is 0 when the team arrives exactly at the end', () => {
		expect(minutesLate(ENDS_AT, ENDS_AT)).toBe(0);
	});

	it('rounds down, so under a minute late is 0', () => {
		expect(minutesLate(ENDS_AT, '2026-06-01T19:00:59.999Z')).toBe(0);
	});

	it('counts exactly one minute late as 1', () => {
		expect(minutesLate(ENDS_AT, '2026-06-01T19:01:00.000Z')).toBe(1);
	});

	it('rounds down partial minutes', () => {
		expect(minutesLate(ENDS_AT, '2026-06-01T19:07:45.000Z')).toBe(7);
	});

	it('has no cap', () => {
		expect(minutesLate(ENDS_AT, '2026-06-02T19:00:00.000Z')).toBe(24 * 60);
	});

	it('rejects a timestamp that does not parse', () => {
		expect(() => minutesLate(ENDS_AT, 'yesterday')).toThrow(RangeError);
		expect(() => minutesLate('soon', ENDS_AT)).toThrow(RangeError);
	});
});

describe('latePenalty', () => {
	it('multiplies whole minutes late by the penalty per minute', () => {
		expect(latePenalty(ENDS_AT, '2026-06-01T19:07:45.000Z', 5)).toBe(35);
	});

	it('is 0 without an arrival', () => {
		expect(latePenalty(ENDS_AT, null, 5)).toBe(0);
	});

	it('is 0 when arriving on time', () => {
		expect(latePenalty(ENDS_AT, '2026-06-01T18:59:00.000Z', 5)).toBe(0);
	});

	it('is 0 when the penalty per minute is 0', () => {
		expect(latePenalty(ENDS_AT, '2026-06-01T19:30:00.000Z', 0)).toBe(0);
	});
});

describe('rankByTotal', () => {
	it('ranks the highest total first', () => {
		expect(rankByTotal([10, 30, 20])).toEqual([3, 1, 2]);
	});

	it('gives tied totals the same rank and skips the next ones', () => {
		expect(rankByTotal([50, 50, 40, 30, 30, 30, 10])).toEqual([1, 1, 3, 4, 4, 4, 7]);
	});

	it('ranks everyone first when all totals are equal', () => {
		expect(rankByTotal([0, 0, 0])).toEqual([1, 1, 1]);
	});

	it('ranks negative totals below zero', () => {
		expect(rankByTotal([-5, 0])).toEqual([2, 1]);
	});

	it('handles no teams', () => {
		expect(rankByTotal([])).toEqual([]);
	});
});

describe('computeScoreboard', () => {
	const game = { endsAt: ENDS_AT, latePenaltyPerMinute: 2 };

	it('adds scored claims and adjustments, then subtracts the late penalty', () => {
		const [row] = computeScoreboard({
			game,
			teams: [team(1, { arrivedAt: '2026-06-01T19:03:30.000Z' })],
			claims: [scored(1, 10), scored(1, 25)],
			adjustments: [
				{ teamId: 1, points: 5 },
				{ teamId: 1, points: -3 }
			]
		});

		expect(row).toEqual({
			teamId: 1,
			name: 'Team 1',
			claimPoints: 35,
			adjustmentPoints: 2,
			minutesLate: 3,
			latePenalty: 6,
			total: 31,
			rank: 1
		});
	});

	it('counts pending and rejected claims as zero', () => {
		const [row] = computeScoreboard({
			game,
			teams: [team(1)],
			claims: [
				scored(1, 10),
				{ teamId: 1, status: 'pending', points: null },
				{ teamId: 1, status: 'rejected', points: 40 }
			],
			adjustments: []
		});

		expect(row.claimPoints).toBe(10);
		expect(row.total).toBe(10);
	});

	it('gives a team with nothing a zero row', () => {
		const [row] = computeScoreboard({ game, teams: [team(1)], claims: [], adjustments: [] });

		expect(row).toMatchObject({
			claimPoints: 0,
			adjustmentPoints: 0,
			minutesLate: 0,
			latePenalty: 0,
			total: 0,
			rank: 1
		});
	});

	it('applies no penalty to a team that never arrived', () => {
		const [row] = computeScoreboard({
			game,
			teams: [team(1)],
			claims: [scored(1, 10)],
			adjustments: []
		});

		expect(row.latePenalty).toBe(0);
		expect(row.total).toBe(10);
	});

	it('allows a negative total', () => {
		const [row] = computeScoreboard({
			game,
			teams: [team(1, { arrivedAt: '2026-06-01T19:10:00.000Z' })],
			claims: [scored(1, 5)],
			adjustments: []
		});

		expect(row.total).toBe(-15);
	});

	it('keeps each team to its own claims and adjustments', () => {
		const rows = computeScoreboard({
			game,
			teams: [team(1), team(2)],
			claims: [scored(1, 10), scored(2, 20)],
			adjustments: [{ teamId: 2, points: 1 }]
		});

		expect(rows.map((r) => [r.teamId, r.total])).toEqual([
			[2, 21],
			[1, 10]
		]);
	});

	it('ignores claims and adjustments of teams not in the list', () => {
		const rows = computeScoreboard({
			game,
			teams: [team(1)],
			claims: [scored(1, 10), scored(99, 50)],
			adjustments: [{ teamId: 99, points: 5 }]
		});

		expect(rows).toHaveLength(1);
		expect(rows[0].total).toBe(10);
	});

	it('orders by rank, with tied teams sharing a rank in team position order', () => {
		const rows = computeScoreboard({
			game,
			teams: [
				team(1, { position: 3 }),
				team(2, { position: 1 }),
				team(3, { position: 2 }),
				team(4, { position: 0 })
			],
			claims: [scored(1, 20), scored(2, 10), scored(3, 20), scored(4, 5)],
			adjustments: []
		});

		expect(rows.map((r) => [r.teamId, r.rank])).toEqual([
			[3, 1],
			[1, 1],
			[2, 3],
			[4, 4]
		]);
	});

	it('ranks on the total after penalty, not on claim points', () => {
		const rows = computeScoreboard({
			game,
			teams: [team(1, { arrivedAt: '2026-06-01T19:05:00.000Z' }), team(2)],
			claims: [scored(1, 20), scored(2, 15)],
			adjustments: []
		});

		expect(rows.map((r) => [r.teamId, r.total, r.rank])).toEqual([
			[2, 15, 1],
			[1, 10, 2]
		]);
	});

	it('returns no rows for a game without teams', () => {
		expect(computeScoreboard({ game, teams: [], claims: [], adjustments: [] })).toEqual([]);
	});
});
