import { beforeEach, describe, expect, it } from 'vitest';
import { listTeamClaims } from './claims.js';
import { clearGameMedia, countGameMedia, listGameMedia } from './claim-media.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow, TeamRow } from './types.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let theirs: TeamRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	const other = await createGame(db, 'Other hunt');
	theirs = await seedTeam(db, other.id);
	const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
	const elsewhere = await seedChallenge(db, other.id);

	await seedClaim(db, rats.id, swim.id, { status: 'rejected', media_key: '1/claims/a.jpg' });
	await seedClaim(db, rats.id, swim.id, {
		status: 'scored',
		points: 5,
		media_key: '1/claims/b.mp4'
	});
	await seedClaim(db, theirs.id, elsewhere.id, { media_key: '2/claims/c.jpg' });
	await seedClaim(db, theirs.id, elsewhere.id, { status: 'rejected' });
});

describe('listGameMedia', () => {
	it('lists every claim of the game with media, any status, oldest first', async () => {
		const media = await listGameMedia(db, game.id);

		expect(media).toEqual([
			expect.objectContaining({
				team_name: 'Canal Rats',
				challenge_title: 'Swim in a fountain',
				media_key: '1/claims/a.jpg'
			}),
			expect.objectContaining({ media_key: '1/claims/b.mp4' })
		]);
		expect(media[0].claim_id).toBeLessThan(media[1].claim_id);
	});
});

describe('countGameMedia', () => {
	it('counts the claims of the game with media', async () => {
		expect(await countGameMedia(db, game.id)).toBe(2);
	});
});

describe('clearGameMedia', () => {
	it('unlinks the media of every claim of the game and keeps the claims', async () => {
		await clearGameMedia(db, game.id);

		expect((await listTeamClaims(db, rats.id)).map((claim) => claim.media_key)).toEqual([
			null,
			null
		]);
		expect((await listTeamClaims(db, theirs.id))[0].media_key).toBe('2/claims/c.jpg');
	});
});
