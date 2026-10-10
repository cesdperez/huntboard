import { describe, expect, it } from 'vitest';
import { teamBoard, type BoardChallenge, type BoardClaim } from './team-board.js';

function challenge(id: number, overrides: Partial<BoardChallenge> = {}): BoardChallenge {
	return {
		id,
		title: `Challenge ${id}`,
		description: null,
		section: null,
		min_points: 5,
		max_points: 10,
		...overrides
	};
}

function claim(id: number, challengeId: number, overrides: Partial<BoardClaim> = {}): BoardClaim {
	return {
		id,
		challenge_id: challengeId,
		status: 'pending',
		note: null,
		marked_by: 'Sam',
		marked_at: '2026-06-01T17:00:00.000Z',
		points: null,
		judged_by: null,
		judge_note: null,
		...overrides
	};
}

describe('teamBoard', () => {
	it('keeps the challenge order and shows unclaimed challenges as open', () => {
		const board = teamBoard([challenge(2), challenge(1)], []);

		expect(board.map((row) => [row.id, row.claim])).toEqual([
			[2, null],
			[1, null]
		]);
	});

	it('copies the challenge fields the team page shows', () => {
		const [row] = teamBoard(
			[challenge(1, { title: 'Swim', description: 'Any fountain', section: 'Water' })],
			[]
		);

		expect(row).toEqual({
			id: 1,
			title: 'Swim',
			description: 'Any fountain',
			section: 'Water',
			minPoints: 5,
			maxPoints: 10,
			claim: null
		});
	});

	it('shows the pending claim with who marked it and the note', () => {
		const [row] = teamBoard([challenge(1)], [claim(7, 1, { note: 'photo at 17:02' })]);

		expect(row.claim).toEqual({
			id: 7,
			status: 'pending',
			note: 'photo at 17:02',
			markedBy: 'Sam',
			markedAt: '2026-06-01T17:00:00.000Z',
			points: null,
			judgedBy: null,
			judgeNote: null
		});
	});

	it('shows a scored claim with its points', () => {
		const [row] = teamBoard(
			[challenge(1)],
			[claim(7, 1, { status: 'scored', points: 8, judged_by: 'Alex' })]
		);

		expect(row.claim).toMatchObject({ status: 'scored', points: 8, judgedBy: 'Alex' });
	});

	it('shows a rejected claim with the reason when nothing replaced it', () => {
		const [row] = teamBoard(
			[challenge(1)],
			[claim(7, 1, { status: 'rejected', judged_by: 'Alex', judge_note: 'No proof received' })]
		);

		expect(row.claim).toMatchObject({ id: 7, status: 'rejected', judgeNote: 'No proof received' });
	});

	it('prefers the active claim over earlier rejections', () => {
		const [row] = teamBoard(
			[challenge(1)],
			[claim(7, 1, { status: 'rejected' }), claim(9, 1, { status: 'pending' })]
		);

		expect(row.claim).toMatchObject({ id: 9, status: 'pending' });
	});

	it('prefers the active claim over a later rejection', () => {
		const [row] = teamBoard(
			[challenge(1)],
			[claim(7, 1, { status: 'scored', points: 8 }), claim(9, 1, { status: 'rejected' })]
		);

		expect(row.claim).toMatchObject({ id: 7, status: 'scored' });
	});

	it('shows the latest rejection when a challenge was rejected more than once', () => {
		const [row] = teamBoard(
			[challenge(1)],
			[
				claim(9, 1, { status: 'rejected', judge_note: 'Still blurry' }),
				claim(7, 1, { status: 'rejected', judge_note: 'Blurry' })
			]
		);

		expect(row.claim).toMatchObject({ id: 9, judgeNote: 'Still blurry' });
	});

	it('matches claims to their own challenge only', () => {
		const board = teamBoard([challenge(1), challenge(2)], [claim(7, 2)]);

		expect(board.map((row) => row.claim?.id ?? null)).toEqual([null, 7]);
	});

	it('ignores claims on challenges that are not on the board', () => {
		const board = teamBoard([challenge(1)], [claim(7, 99)]);

		expect(board[0].claim).toBeNull();
	});
});
