import { describe, expect, it } from 'vitest';
import { judgedClaimMessages } from './judged-claims.js';
import type { TeamChallenge, TeamClaim } from './team-board.js';

function challenge(id: number, claim: Partial<TeamClaim> | null = null): TeamChallenge {
	return {
		id,
		title: `Challenge ${id}`,
		description: null,
		section: null,
		minPoints: 5,
		maxPoints: 10,
		claim: claim && {
			id: 1,
			status: 'pending',
			note: null,
			markedBy: 'Sam',
			markedAt: '2026-06-01T17:00:00.000Z',
			points: null,
			judgedBy: null,
			judgeNote: null,
			...claim
		}
	};
}

describe('judgedClaimMessages', () => {
	it('says nothing when no claim changed', () => {
		const board = [challenge(1, { status: 'scored', points: 8 }), challenge(2)];
		expect(judgedClaimMessages(board, board)).toEqual([]);
	});

	it('names the points and the challenge of a scored claim', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { status: 'pending' })],
				[challenge(1, { status: 'scored', points: 8 })]
			)
		).toEqual(['Scored 8 for Challenge 1']);
	});

	it('repeats the reason of a rejected claim', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { status: 'pending' })],
				[challenge(1, { status: 'rejected', judgeNote: 'no proof received' })]
			)
		).toEqual(['Rejected Challenge 1: no proof received. You can mark it done again.']);
	});

	it('names the challenge of a rejection without a reason', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { status: 'pending' })],
				[challenge(1, { status: 'rejected' })]
			)
		).toEqual(['Rejected Challenge 1. You can mark it done again.']);
	});

	it('gives one message per judged claim, in board order', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { id: 1 }), challenge(2, { id: 2 }), challenge(3, { id: 3 })],
				[
					challenge(1, { id: 1, status: 'scored', points: 5 }),
					challenge(2, { id: 2 }),
					challenge(3, { id: 3, status: 'rejected' })
				]
			)
		).toEqual(['Scored 5 for Challenge 1', 'Rejected Challenge 3. You can mark it done again.']);
	});

	it('stays quiet when the team marks a challenge done or undoes it', () => {
		expect(judgedClaimMessages([challenge(1)], [challenge(1, { status: 'pending' })])).toEqual([]);
		expect(judgedClaimMessages([challenge(1, { status: 'pending' })], [challenge(1)])).toEqual([]);
	});

	it('stays quiet when an undo shows an earlier rejection again', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { id: 7, status: 'pending' })],
				[challenge(1, { id: 3, status: 'rejected' })]
			)
		).toEqual([]);
	});

	it('stays quiet when the team claims a rejected challenge again', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { id: 3, status: 'rejected' })],
				[challenge(1, { id: 7, status: 'pending' })]
			)
		).toEqual([]);
	});

	it('tells a claim marked and judged between two polls', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { id: 3, status: 'rejected' })],
				[challenge(1, { id: 7, status: 'rejected', judgeNote: 'blurry' })]
			)
		).toEqual(['Rejected Challenge 1: blurry. You can mark it done again.']);
		expect(
			judgedClaimMessages([challenge(1)], [challenge(1, { status: 'scored', points: 6 })])
		).toEqual(['Scored 6 for Challenge 1']);
	});

	it('tells a judge correcting the points of a scored claim', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { status: 'scored', points: 8 })],
				[challenge(1, { status: 'scored', points: 10 })]
			)
		).toEqual(['Scored 10 for Challenge 1']);
	});

	it('tells a judge rejecting a scored claim', () => {
		expect(
			judgedClaimMessages(
				[challenge(1, { status: 'scored', points: 8 })],
				[challenge(1, { status: 'rejected' })]
			)
		).toEqual(['Rejected Challenge 1. You can mark it done again.']);
	});

	it('tells a claim on a challenge the organiser added since the last poll', () => {
		expect(judgedClaimMessages([], [challenge(1, { status: 'scored', points: 5 })])).toEqual([
			'Scored 5 for Challenge 1'
		]);
	});
});
