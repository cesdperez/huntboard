import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, getGameById } from './games.js';
import { getTeamByToken } from './links.js';
import { setGameImage, setGameImageLabel, setTeamAvatar } from './images.js';
import { createTestDb } from './testing/test-db.js';
import { seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
});

describe('setGameImage', () => {
	it('starts without an image', () => {
		expect(game).toMatchObject({ image_key: null, image_label: '' });
	});

	it('sets the key and label and returns the key it replaced', async () => {
		expect(await setGameImage(db, game.id, '1/first.webp', 'Invitation')).toEqual({
			previous: null
		});
		expect(await setGameImage(db, game.id, '1/second.webp', 'Map')).toEqual({
			previous: '1/first.webp'
		});
		expect(await getGameById(db, game.id)).toMatchObject({
			image_key: '1/second.webp',
			image_label: 'Map'
		});
	});

	it('clears the image with a null key', async () => {
		await setGameImage(db, game.id, '1/first.webp', 'Invitation');

		expect(await setGameImage(db, game.id, null, '')).toEqual({ previous: '1/first.webp' });
		expect(await getGameById(db, game.id)).toMatchObject({ image_key: null, image_label: '' });
	});

	it('returns null for a game that does not exist', async () => {
		expect(await setGameImage(db, game.id + 1, '1/first.webp', '')).toBeNull();
	});
});

describe('setGameImageLabel', () => {
	it('changes only the label', async () => {
		await setGameImage(db, game.id, '1/first.webp', 'Invitation');

		await setGameImageLabel(db, game.id, 'Birthday invitation');

		expect(await getGameById(db, game.id)).toMatchObject({
			image_key: '1/first.webp',
			image_label: 'Birthday invitation'
		});
	});
});

describe('setTeamAvatar', () => {
	it('sets the avatar and returns the key it replaced', async () => {
		const rats = await seedTeam(db, game.id);

		expect(await setTeamAvatar(db, game.id, rats.id, '1/a.webp')).toEqual({ previous: null });
		expect(await setTeamAvatar(db, game.id, rats.id, '1/b.webp')).toEqual({
			previous: '1/a.webp'
		});
		expect(await getTeamByToken(db, rats.token)).toMatchObject({ avatar_key: '1/b.webp' });
	});

	it('leaves a team of another game alone and returns null', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedTeam(db, other.id, { avatar_key: '2/theirs.webp' });

		expect(await setTeamAvatar(db, game.id, elsewhere.id, null)).toBeNull();
		expect(await getTeamByToken(db, elsewhere.token)).toMatchObject({
			avatar_key: '2/theirs.webp'
		});
	});
});
