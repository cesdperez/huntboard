import { beforeEach, describe, expect, it } from 'vitest';
import { formatJoinCode, joinCodeOf } from '#lib/domain/join-code.js';
import { generateToken } from '#lib/domain/token.js';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedTeam } from '../db/testing/seed.js';
import { joinTeam } from './join-team.js';

let db: D1Database;
let token: string;

beforeEach(async () => {
	db = createTestDb();
	const game = await createGame(db, 'Canal hunt');
	token = (await seedTeam(db, game.id, { token: generateToken() })).token;
});

function form(code: string): FormData {
	const data = new FormData();
	data.set('code', code);
	return data;
}

describe('joinTeam', () => {
	it('returns the team token for its code', async () => {
		expect(await joinTeam(db, form(formatJoinCode(joinCodeOf(token))))).toEqual({ token });
	});

	it('takes the code typed in lower case without the dash', async () => {
		expect(await joinTeam(db, form(joinCodeOf(token).toLowerCase()))).toEqual({ token });
	});

	it('says no team has a code that opens nothing', async () => {
		const code = joinCodeOf(generateToken());

		expect(await joinTeam(db, form(code))).toEqual({
			status: 404,
			result: { code, error: 'No team has this code. Check it with your organiser.' }
		});
	});

	it('says what a code looks like when the input cannot be one', async () => {
		expect(await joinTeam(db, form('K7Q4-M2X'))).toEqual({
			status: 400,
			result: { code: 'K7Q4-M2X', error: 'A join code has 8 letters and digits, like K7Q4-M2XD.' }
		});
	});

	it('asks for the code when the field is empty', async () => {
		expect(await joinTeam(db, form('  '))).toEqual({
			status: 400,
			result: { code: '', error: 'Type the join code your organiser gave you.' }
		});
	});
});
