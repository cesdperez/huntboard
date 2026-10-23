import { beforeEach, describe, expect, it } from 'vitest';
import { getGameByAdminToken } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { createNewGame } from './new-game.js';

const CODE = 'creation-secret';

let db: D1Database;

beforeEach(() => {
	db = createTestDb();
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

async function gameCount() {
	return db.prepare('SELECT count(*) AS n FROM game').first<number>('n');
}

describe('createNewGame', () => {
	it('creates the game and returns its admin token when the code matches', async () => {
		const outcome = await createNewGame(db, CODE, form({ name: ' Canal hunt ', code: CODE }));

		expect(outcome).toEqual({ adminToken: expect.any(String) });
		const adminToken = (outcome as { adminToken: string }).adminToken;
		expect(await getGameByAdminToken(db, adminToken)).toMatchObject({ name: 'Canal hunt' });
	});

	it('refuses a wrong creation code and keeps the typed name', async () => {
		const outcome = await createNewGame(db, CODE, form({ name: 'Canal hunt', code: 'guess' }));

		expect(outcome).toEqual({
			status: 403,
			result: {
				name: 'Canal hunt',
				error: 'That creation code is not right. Check it and try again.'
			}
		});
		expect(await gameCount()).toBe(0);
	});

	it('refuses every code when no creation code is set', async () => {
		const outcome = await createNewGame(db, undefined, form({ name: 'Canal hunt', code: '' }));

		expect(outcome).toMatchObject({ status: 403 });
		expect(await gameCount()).toBe(0);
	});

	it('refuses an empty name before it checks the code', async () => {
		const outcome = await createNewGame(db, CODE, form({ name: '  ', code: 'guess' }));

		expect(outcome).toEqual({ status: 400, result: { name: '', error: 'Give the game a name.' } });
		expect(await gameCount()).toBe(0);
	});
});
