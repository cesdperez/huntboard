import { describe, expect, it } from 'vitest';
import { deleteTeamQuestion } from './delete-team-question.js';

const team = { name: 'Canal Rats', adjustment_count: 0, arrived_at: null };
const ARRIVED = '2026-06-01T21:03:00.000Z';

describe('deleteTeamQuestion', () => {
	it('names only the link for a team with nothing else', () => {
		expect(deleteTeamQuestion(team)).toBe('Delete Canal Rats? Its link stops working.');
	});

	it('names the adjustments that go with the team', () => {
		expect(deleteTeamQuestion({ ...team, adjustment_count: 2 })).toBe(
			'Delete Canal Rats? Its 2 adjustments are deleted too, and its link stops working.'
		);
	});

	it('names the arrival time that goes with the team', () => {
		expect(deleteTeamQuestion({ ...team, arrived_at: ARRIVED })).toBe(
			'Delete Canal Rats? Its arrival time is deleted too, and its link stops working.'
		);
	});

	it('names both', () => {
		expect(deleteTeamQuestion({ ...team, adjustment_count: 1, arrived_at: ARRIVED })).toBe(
			'Delete Canal Rats? Its 1 adjustment and its arrival time are deleted too, and its link stops working.'
		);
	});
});
