import { describe, expect, it } from 'vitest';
import { judgingGrid, type GridClaim } from './judging-grid.js';
import type { BoardChallenge } from './team-board.js';

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

function claim(
	id: number,
	teamId: number,
	challengeId: number,
	overrides: Partial<GridClaim> = {}
): GridClaim {
	return {
		id,
		team_id: teamId,
		challenge_id: challengeId,
		status: 'pending',
		note: null,
		marked_by: 'Sam',
		marked_at: '2026-06-01T17:00:00.000Z',
		points: null,
		judged_by: null,
		judge_note: null,
		media_key: null,
		...overrides
	};
}

const rats = { id: 1, name: 'Canal Rats' };
const owls = { id: 2, name: 'Night Owls' };

describe('judgingGrid', () => {
	it('has a row per challenge with one open cell per team, in the given orders', () => {
		const grid = judgingGrid([challenge(2), challenge(1)], [owls, rats], []);

		expect(grid.map((row) => [row.id, row.cells.map((cell) => [cell.teamId, cell.claim])])).toEqual(
			[
				[
					2,
					[
						[2, null],
						[1, null]
					]
				],
				[
					1,
					[
						[2, null],
						[1, null]
					]
				]
			]
		);
	});

	it('copies the challenge fields the grid shows', () => {
		const [row] = judgingGrid(
			[challenge(1, { title: 'Swim', description: 'Any fountain', section: 'Water' })],
			[rats],
			[]
		);

		expect(row).toMatchObject({
			id: 1,
			title: 'Swim',
			description: 'Any fountain',
			section: 'Water',
			minPoints: 5,
			maxPoints: 10
		});
	});

	it('puts each claim in the cell of its own team and challenge', () => {
		const grid = judgingGrid(
			[challenge(1), challenge(2)],
			[rats, owls],
			[
				claim(7, rats.id, 2, { status: 'scored', points: 8 }),
				claim(8, owls.id, 1, { note: 'photo' })
			]
		);

		expect(grid.map((row) => row.cells.map((cell) => cell.claim?.id ?? null))).toEqual([
			[null, 8],
			[7, null]
		]);
		expect(grid[0].cells[1].claim).toMatchObject({ status: 'pending', note: 'photo' });
	});

	it('shows the active claim over a rejection of the same team, like the team page', () => {
		const [row] = judgingGrid(
			[challenge(1)],
			[rats],
			[claim(7, rats.id, 1, { status: 'rejected' }), claim(9, rats.id, 1)]
		);

		expect(row.cells[0].claim).toMatchObject({ id: 9, status: 'pending' });
	});

	it('ignores claims of teams and challenges not in the grid', () => {
		const grid = judgingGrid([challenge(1)], [rats], [claim(7, 99, 1), claim(8, rats.id, 99)]);

		expect(grid[0].cells).toEqual([{ teamId: rats.id, claim: null }]);
	});

	it('has no rows without challenges and no cells without teams', () => {
		expect(judgingGrid([], [rats], [])).toEqual([]);
		expect(judgingGrid([challenge(1)], [], [])[0].cells).toEqual([]);
	});
});
