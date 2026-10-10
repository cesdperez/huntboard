import { beforeEach, describe, expect, it } from 'vitest';
import { addAdjustment, deleteAdjustment, listAdjustments } from './adjustments.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedAdjustment, seedTeam } from './testing/seed.js';
import type { GameRow, TeamRow } from './types.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
});

async function outsider() {
	const other = await createGame(db, 'Other hunt');
	return seedTeam(db, other.id);
}

describe('listAdjustments', () => {
	it('lists the adjustments of this game teams, oldest first', async () => {
		const owls = await seedTeam(db, game.id);
		const first = await seedAdjustment(db, owls.id, { points: -5 });
		const second = await seedAdjustment(db, rats.id, { points: 10 });
		await seedAdjustment(db, (await outsider()).id);

		const adjustments = await listAdjustments(db, game.id);

		expect(adjustments).toEqual([first, second]);
	});
});

describe('addAdjustment', () => {
	it('adds a signed adjustment with its reason and author', async () => {
		const added = await addAdjustment(db, game.id, rats.id, {
			points: -10,
			reason: 'Never showed up',
			createdBy: 'Alex'
		});

		expect(added).toEqual(
			expect.objectContaining({
				team_id: rats.id,
				points: -10,
				reason: 'Never showed up',
				created_by: 'Alex'
			})
		);
		expect(await listAdjustments(db, game.id)).toEqual([added]);
	});

	it('refuses a team of another game', async () => {
		const team = await outsider();

		expect(
			await addAdjustment(db, game.id, team.id, { points: 5, reason: 'Bonus', createdBy: 'Alex' })
		).toBeNull();
	});
});

describe('deleteAdjustment', () => {
	it('deletes an adjustment of this game', async () => {
		const adjustment = await seedAdjustment(db, rats.id);

		expect(await deleteAdjustment(db, game.id, adjustment.id)).toBe(true);
		expect(await listAdjustments(db, game.id)).toEqual([]);
	});

	it('leaves another game adjustment alone', async () => {
		const adjustment = await seedAdjustment(db, (await outsider()).id);

		expect(await deleteAdjustment(db, game.id, adjustment.id)).toBe(false);
	});
});
