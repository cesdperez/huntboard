import { beforeEach, describe, expect, it } from 'vitest';
import { clearGameUploads, isTeamUpload, recordMediaUpload } from './media-uploads.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedTeam } from './testing/seed.js';
import type { GameRow, TeamRow } from './types.js';

const LIMITS = { uploadsPerChallenge: 2, teamMaxBytes: 100, gameMaxBytes: 150 };

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Bridge Owls' });
	await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
});

function record(team: TeamRow, key: string, size: number) {
	return recordMediaUpload(db, { gameId: game.id, teamId: team.id, key, size }, LIMITS);
}

describe('recordMediaUpload', () => {
	it('records uploads within every limit', async () => {
		expect(await record(rats, 'a', 10)).toBe('recorded');
		expect(await isTeamUpload(db, rats.id, 'a')).toBe(true);
	});

	it('allows uploadsPerChallenge for each challenge in the game', async () => {
		await record(rats, 'a', 1);
		await record(rats, 'b', 1);
		expect(await record(rats, 'c', 1)).toBe('team-count');

		await seedChallenge(db, game.id, { title: 'Feed a duck' });
		expect(await record(rats, 'c', 1)).toBe('recorded');
	});

	it('refuses an upload that takes the team past its bytes', async () => {
		await record(rats, 'a', 60);
		expect(await record(rats, 'b', 41)).toBe('team-bytes');
		expect(await record(rats, 'b', 40)).toBe('recorded');
	});

	it('refuses an upload that takes the game past its bytes, whichever team sends it', async () => {
		await record(rats, 'a', 100);
		expect(await record(owls, 'b', 51)).toBe('game-bytes');
		expect(await record(owls, 'b', 50)).toBe('recorded');
	});

	it('counts no other game', async () => {
		const other = await createGame(db, 'Other hunt');
		const theirs = await seedTeam(db, other.id);
		await seedChallenge(db, other.id);
		await recordMediaUpload(
			db,
			{ gameId: other.id, teamId: theirs.id, key: 'x', size: 100 },
			LIMITS
		);
		expect(await record(rats, 'a', 100)).toBe('recorded');
	});

	it('reports a team deleted since its link was checked', async () => {
		const gone = await seedTeam(db, game.id, { name: 'Gone' });
		await db.prepare('DELETE FROM team WHERE id = ?').bind(gone.id).run();

		expect(await record(gone, 'a', 10)).toBe('team-gone');
	});
});

describe('isTeamUpload', () => {
	it('is true only for the team the key was signed for', async () => {
		await record(rats, 'a', 10);
		expect(await isTeamUpload(db, owls.id, 'a')).toBe(false);
		expect(await isTeamUpload(db, rats.id, 'b')).toBe(false);
	});
});

describe('clearGameUploads', () => {
	it('frees the game budget and keeps other games', async () => {
		const other = await createGame(db, 'Other hunt');
		const theirs = await seedTeam(db, other.id);
		await seedChallenge(db, other.id);
		await recordMediaUpload(db, { gameId: other.id, teamId: theirs.id, key: 'x', size: 1 }, LIMITS);
		await record(rats, 'a', 100);

		await clearGameUploads(db, game.id);

		expect(await isTeamUpload(db, rats.id, 'a')).toBe(false);
		expect(await isTeamUpload(db, theirs.id, 'x')).toBe(true);
		expect(await record(rats, 'b', 100)).toBe('recorded');
	});
});
