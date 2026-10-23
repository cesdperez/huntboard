import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameById, updateGameSettings } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import type { GameRow } from '../db/types.js';
import { saveGameSettings } from './game-settings.js';

const STARTS_AT = '2026-06-20T14:00:00.000Z';
const ENDS_AT = '2026-06-20T19:00:00.000Z';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	const created = await createGame(db, 'Canal hunt');
	game = await updateGameSettings(db, created.id, {
		name: 'Canal hunt',
		starts_at: STARTS_AT,
		ends_at: ENDS_AT,
		late_penalty_per_minute: 0,
		theme: 'flag'
	});
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('saveGameSettings', () => {
	it('saves every field the form sends', async () => {
		const outcome = await saveGameSettings(
			db,
			game,
			form({
				name: ' Pier hunt ',
				starts_at: '2026-06-21T10:00:00.000Z',
				ends_at: '2026-06-21T12:00:00.000Z',
				late_penalty_per_minute: '3',
				theme: 'highland-bru'
			})
		);

		expect(outcome).toEqual({ status: 200, result: { saved: true } });
		expect(await getGameById(db, game.id)).toMatchObject({
			name: 'Pier hunt',
			starts_at: '2026-06-21T10:00:00.000Z',
			ends_at: '2026-06-21T12:00:00.000Z',
			late_penalty_per_minute: 3,
			theme: 'highland-bru'
		});
	});

	it('keeps the stored times and theme when the form sends none', async () => {
		const outcome = await saveGameSettings(
			db,
			game,
			form({ name: 'Pier hunt', late_penalty_per_minute: '2' })
		);

		expect(outcome).toEqual({ status: 200, result: { saved: true } });
		expect(await getGameById(db, game.id)).toMatchObject({
			name: 'Pier hunt',
			starts_at: STARTS_AT,
			ends_at: ENDS_AT,
			late_penalty_per_minute: 2,
			theme: 'flag'
		});
	});

	it('refuses an end time that is not after the start, and saves nothing', async () => {
		const outcome = await saveGameSettings(
			db,
			game,
			form({
				name: 'Pier hunt',
				starts_at: ENDS_AT,
				ends_at: STARTS_AT,
				late_penalty_per_minute: '0'
			})
		);

		expect(outcome).toEqual({
			status: 400,
			result: { errors: { ends_at: 'End the game after it starts.' } }
		});
		expect(await getGameById(db, game.id)).toEqual(game);
	});
});
