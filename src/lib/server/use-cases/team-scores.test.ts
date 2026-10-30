import { beforeEach, describe, expect, it } from 'vitest';
import { listAdjustments } from '../db/adjustments.js';
import { createGame } from '../db/games.js';
import { listTeamsWithClaimCounts } from '../db/teams.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedAdjustment, seedTeam } from '../db/testing/seed.js';
import type { GameRow, TeamRow } from '../db/types.js';
import {
	addTeamAdjustment,
	clearArrival,
	correctArrival,
	recordArrival,
	removeAdjustment
} from './team-scores.js';

const NOW = new Date('2026-06-01T21:03:12.345Z');

let db: D1Database;
let game: GameRow;
let rats: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

async function arrivedAt() {
	return (await listTeamsWithClaimCounts(db, game.id))[0].arrived_at;
}

describe('addTeamAdjustment', () => {
	const fields = {
		teamId: '',
		sign: 'penalty',
		points: '10',
		reason: 'Never showed up',
		nickname: 'Alex'
	};

	it('adds the adjustment by the nickname', async () => {
		const outcome = await addTeamAdjustment(
			db,
			game.id,
			form({ ...fields, teamId: String(rats.id) })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'adjusted' } });
		expect(await listAdjustments(db, game.id)).toEqual([
			expect.objectContaining({ points: -10, reason: 'Never showed up', created_by: 'Alex' })
		]);
	});

	it('returns the typed values with the errors', async () => {
		const outcome = await addTeamAdjustment(
			db,
			game.id,
			form({ ...fields, teamId: String(rats.id), points: '0', reason: '' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'adjustment-invalid',
				values: { sign: 'penalty', points: '0', reason: '' },
				errors: {
					points: 'Enter a whole number of points above 0, like 10.',
					reason: 'Say why, so other judges know what it was for.'
				}
			}
		});
		expect(await listAdjustments(db, game.id)).toEqual([]);
	});

	it('asks for a nickname when there is none', async () => {
		const outcome = await addTeamAdjustment(
			db,
			game.id,
			form({ ...fields, teamId: String(rats.id), nickname: '' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'error',
				message: 'Set your nickname first, so everyone knows who added this.'
			}
		});
	});

	it('refuses a team that is gone', async () => {
		const outcome = await addTeamAdjustment(db, game.id, form({ ...fields, teamId: '9999' }));

		expect(outcome).toEqual({
			status: 404,
			result: {
				kind: 'error',
				message: 'That team is not in this game any more. Reload the page.'
			}
		});
	});
});

describe('removeAdjustment', () => {
	it('deletes the adjustment', async () => {
		const adjustment = await seedAdjustment(db, rats.id);

		const outcome = await removeAdjustment(
			db,
			game.id,
			form({ adjustmentId: String(adjustment.id) })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'adjustment-removed' } });
		expect(await listAdjustments(db, game.id)).toEqual([]);
	});

	it('says when another judge already removed it', async () => {
		const outcome = await removeAdjustment(db, game.id, form({ adjustmentId: '9999' }));

		expect(outcome).toEqual({
			status: 404,
			result: { kind: 'error', message: 'This adjustment was already removed.' }
		});
	});
});

describe('recordArrival', () => {
	it('records the arrival at the server time', async () => {
		const outcome = await recordArrival(db, game.id, form({ teamId: String(rats.id) }), NOW);

		expect(outcome).toEqual({ status: 200, result: { kind: 'arrival' } });
		expect(await arrivedAt()).toBe('2026-06-01T21:03:12.345Z');
	});

	it('keeps the arrival another judge recorded first', async () => {
		await recordArrival(db, game.id, form({ teamId: String(rats.id) }), NOW);

		const outcome = await recordArrival(
			db,
			game.id,
			form({ teamId: String(rats.id) }),
			new Date('2026-06-01T21:10:00.000Z')
		);

		expect(outcome).toEqual({
			status: 409,
			result: {
				kind: 'error',
				message: 'The arrival was already recorded. Correct the time if it is wrong.'
			}
		});
		expect(await arrivedAt()).toBe('2026-06-01T21:03:12.345Z');
	});

	it('refuses a team that is gone', async () => {
		const outcome = await recordArrival(db, game.id, form({ teamId: '9999' }), NOW);

		expect(outcome.status).toBe(404);
	});
});

describe('correctArrival', () => {
	it('sets the arrival to the time the browser sent', async () => {
		const outcome = await correctArrival(
			db,
			game.id,
			form({ teamId: String(rats.id), arrivedAt: '2026-06-01T20:58:00.000Z' })
		);

		expect(outcome.status).toBe(200);
		expect(await arrivedAt()).toBe('2026-06-01T20:58:00.000Z');
	});

	it.each(['', 'nine pm'])('refuses %j and keeps the old time', async (value) => {
		await recordArrival(db, game.id, form({ teamId: String(rats.id) }), NOW);

		const outcome = await correctArrival(
			db,
			game.id,
			form({ teamId: String(rats.id), arrivedAt: value })
		);

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: 'Enter the time the team arrived.' }
		});
		expect(await arrivedAt()).toBe('2026-06-01T21:03:12.345Z');
	});
});

describe('clearArrival', () => {
	it('clears the arrival', async () => {
		await recordArrival(db, game.id, form({ teamId: String(rats.id) }), NOW);

		const outcome = await clearArrival(db, game.id, form({ teamId: String(rats.id) }));

		expect(outcome.status).toBe(200);
		expect(await arrivedAt()).toBeNull();
	});
});
