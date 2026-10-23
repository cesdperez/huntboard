import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	GAME_IMAGE_MAX_BYTES,
	IMAGE_LABEL_ERROR,
	IMAGE_LABEL_MAX_LENGTH
} from '#lib/domain/images.js';
import { createGame, getGameById } from '../db/games.js';
import { getTeamByToken } from '../db/links.js';
import { setGameImage } from '../db/images.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { GameRow } from '../db/types.js';
import { IMAGE_TOO_LARGE, NOT_AN_IMAGE } from '../http/image-upload.js';
import {
	deleteTeamWithAvatar,
	removeGameImage,
	removeTeamAvatar,
	resetGameWithImages,
	saveGameImage
} from './images.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);

let db: D1Database;
let bucket: MemoryBucket;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	bucket = new MemoryBucket();
	game = await createGame(db, 'Canal hunt');
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

function form(fields: Record<string, string | Blob>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (typeof value === 'string') data.set(key, value);
		else data.set(key, value, 'image.jpg');
	}
	return data;
}

const jpeg = (bytes = JPEG) => new Blob([bytes], { type: 'image/jpeg' });

async function seedImage(key: string) {
	await bucket.put(key, JPEG);
	return key;
}

describe('saveGameImage', () => {
	it('stores the image under the game and saves its key and label', async () => {
		const outcome = await saveGameImage(
			db,
			bucket.asBucket(),
			game,
			form({ image: jpeg(), label: '  Birthday   invitation ' })
		);

		expect(outcome).toEqual({ status: 200, result: { saved: true } });
		const saved = await getGameById(db, game.id);
		expect(saved).toMatchObject({ image_label: 'Birthday invitation' });
		expect(saved?.image_key).toMatch(new RegExp(`^${game.id}/.+\\.jpg$`));
		expect(bucket.keys()).toEqual([saved?.image_key]);
	});

	it('deletes the image it replaces', async () => {
		const old = await seedImage(`${game.id}/oldoldoldoldoldoldoldo.jpg`);
		await setGameImage(db, game.id, old, 'Map');
		const current = (await getGameById(db, game.id))!;

		await saveGameImage(db, bucket.asBucket(), current, form({ image: jpeg(), label: 'Map' }));

		const saved = await getGameById(db, game.id);
		expect(bucket.keys()).toEqual([saved?.image_key]);
		expect(saved?.image_key).not.toBe(old);
	});

	it('changes only the label when no file is sent and an image exists', async () => {
		const key = await seedImage(`${game.id}/oldoldoldoldoldoldoldo.jpg`);
		await setGameImage(db, game.id, key, 'Map');
		const current = (await getGameById(db, game.id))!;

		const outcome = await saveGameImage(db, bucket.asBucket(), current, form({ label: 'Route' }));

		expect(outcome).toEqual({ status: 200, result: { saved: true } });
		expect(await getGameById(db, game.id)).toMatchObject({ image_key: key, image_label: 'Route' });
		expect(bucket.keys()).toEqual([key]);
	});

	it('asks for an image when there is none yet and no file is sent', async () => {
		const outcome = await saveGameImage(db, bucket.asBucket(), game, form({ label: 'Map' }));

		expect(outcome).toEqual({
			status: 400,
			result: { error: 'Choose an image first.' }
		});
	});

	it('refuses a label that is too long and stores nothing', async () => {
		const label = 'x'.repeat(IMAGE_LABEL_MAX_LENGTH + 1);

		const outcome = await saveGameImage(
			db,
			bucket.asBucket(),
			game,
			form({ image: jpeg(), label })
		);

		expect(outcome).toEqual({ status: 400, result: { error: IMAGE_LABEL_ERROR } });
		expect(bucket.keys()).toEqual([]);
	});

	it('refuses a file that is not a JPEG or WebP image and stores nothing', async () => {
		const png = new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], { type: 'image/png' });

		const outcome = await saveGameImage(db, bucket.asBucket(), game, form({ image: png }));

		expect(outcome).toEqual({ status: 400, result: { error: NOT_AN_IMAGE } });
		expect(bucket.keys()).toEqual([]);
	});

	it('refuses a file over the cap', async () => {
		const big = new Uint8Array(GAME_IMAGE_MAX_BYTES + 1);
		big.set(JPEG);

		const outcome = await saveGameImage(db, bucket.asBucket(), game, form({ image: jpeg(big) }));

		expect(outcome.result.error).toBe(IMAGE_TOO_LARGE);
	});
});

describe('removeGameImage', () => {
	it('clears the image and its label and deletes the object', async () => {
		const key = await seedImage(`${game.id}/oldoldoldoldoldoldoldo.jpg`);
		await setGameImage(db, game.id, key, 'Map');

		await removeGameImage(db, bucket.asBucket(), game.id);

		expect(await getGameById(db, game.id)).toMatchObject({ image_key: null, image_label: '' });
		expect(bucket.keys()).toEqual([]);
	});
});

describe('removeTeamAvatar', () => {
	it('clears the picture and deletes the object', async () => {
		const key = await seedImage(`${game.id}/ratsratsratsratsratsra.jpg`);
		const rats = await seedTeam(db, game.id, { avatar_key: key });

		expect(await removeTeamAvatar(db, bucket.asBucket(), game.id, rats.id)).toBe(true);

		expect(await getTeamByToken(db, rats.token)).toMatchObject({ avatar_key: null });
		expect(bucket.keys()).toEqual([]);
	});

	it('leaves a team of another game and its picture alone', async () => {
		const other = await createGame(db, 'Other hunt');
		const key = await seedImage(`${other.id}/theirstheirstheirsthe.jpg`);
		const elsewhere = await seedTeam(db, other.id, { avatar_key: key });

		expect(await removeTeamAvatar(db, bucket.asBucket(), game.id, elsewhere.id)).toBe(false);

		expect(bucket.keys()).toEqual([key]);
	});
});

describe('deleteTeamWithAvatar', () => {
	it('deletes the picture of a deleted team', async () => {
		const key = await seedImage(`${game.id}/ratsratsratsratsratsra.jpg`);
		const rats = await seedTeam(db, game.id, { avatar_key: key });

		expect(await deleteTeamWithAvatar(db, bucket.asBucket(), game.id, rats.id)).toBe('deleted');
		expect(bucket.keys()).toEqual([]);
	});

	it('keeps the picture of a team that cannot be deleted', async () => {
		const key = await seedImage(`${game.id}/ratsratsratsratsratsra.jpg`);
		const rats = await seedTeam(db, game.id, { avatar_key: key });
		await seedClaim(db, rats.id, (await seedChallenge(db, game.id)).id);

		expect(await deleteTeamWithAvatar(db, bucket.asBucket(), game.id, rats.id)).toBe('has-claims');
		expect(bucket.keys()).toEqual([key]);
	});
});

describe('resetGameWithImages', () => {
	it('deletes every image of the game and none of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const poster = await seedImage(`${game.id}/posterposterposterpost.jpg`);
		await setGameImage(db, game.id, poster, 'Invitation');
		await seedTeam(db, game.id, {
			avatar_key: await seedImage(`${game.id}/ratsratsratsratsratsra.jpg`)
		});
		const theirs = await seedImage(`${other.id}/theirstheirstheirsthe.jpg`);

		const reset = await resetGameWithImages(db, bucket.asBucket(), game.id);

		expect(reset).toMatchObject({ image_key: null, image_label: '' });
		expect(bucket.keys()).toEqual([theirs]);
	});
});
