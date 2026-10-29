import { beforeEach, describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, type MediaType } from '#lib/domain/claim-media.js';
import { newMediaKey } from '../storage/media-store.js';
import { MemoryBucket } from '../testing/memory-bucket.js';
import { countGameMedia, type GameMediaRow } from '../db/claim-media.js';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import {
	MEDIA_NOT_UPLOADED,
	NOT_MEDIA,
	PHOTO_TOO_LARGE,
	checkClaimMedia,
	deleteAllMedia,
	gameMediaZip,
	matchesMediaType,
	mediaZipEntries
} from './claim-media.js';

const ascii = (text: string) => new TextEncoder().encode(text);
const bytes = (...parts: (number[] | string)[]) =>
	Uint8Array.from(parts.flatMap((part) => (typeof part === 'string' ? [...ascii(part)] : part)));

const SAMPLES: Record<MediaType, Uint8Array<ArrayBuffer>> = {
	'image/jpeg': bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]),
	'image/webp': bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '),
	'video/mp4': bytes([0, 0, 0, 0x18], 'ftypisom', [0, 0, 2, 0]),
	'video/quicktime': bytes([0, 0, 0, 0x14], 'ftypqt  ', [0, 0, 0, 0]),
	'video/webm': bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86])
};

describe('matchesMediaType', () => {
	it.each(Object.entries(SAMPLES))('recognises %s', (type, sample) => {
		expect(matchesMediaType(sample, type as MediaType)).toBe(true);
	});

	it('takes an MP4 and a QuickTime file for each other, since both are ISO media', () => {
		expect(matchesMediaType(SAMPLES['video/quicktime'], 'video/mp4')).toBe(true);
		expect(matchesMediaType(SAMPLES['video/mp4'], 'video/quicktime')).toBe(true);
	});

	it.each([
		['image/jpeg', SAMPLES['video/webm']],
		['image/webp', SAMPLES['image/jpeg']],
		['video/mp4', SAMPLES['image/webp']],
		['video/webm', SAMPLES['video/mp4']],
		['video/mp4', bytes('<html>ftyp')],
		['video/mp4', bytes([0, 0, 0])]
	] as const)('refuses other bytes as %s', (type, sample) => {
		expect(matchesMediaType(sample, type)).toBe(false);
	});
});

describe('checkClaimMedia', () => {
	const GAME_ID = 7;
	let bucket: MemoryBucket;

	beforeEach(() => {
		bucket = new MemoryBucket();
	});

	async function upload(type: MediaType, body = SAMPLES[type], contentType: string = type) {
		const key = newMediaKey(GAME_ID, type);
		await bucket.put(key, body, { httpMetadata: { contentType } });
		return key;
	}

	it.each(Object.keys(SAMPLES) as MediaType[])('accepts an uploaded %s', async (type) => {
		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, await upload(type))).toBeNull();
	});

	it('reads only the first bytes of the object', async () => {
		const big = new Uint8Array(4096);
		big.set(SAMPLES['video/webm']);
		const key = await upload('video/webm', big);
		const reads: R2GetOptions[] = [];
		const get = bucket.get.bind(bucket);
		bucket.get = (key, options) => {
			reads.push(options!);
			return get(key, options);
		};

		await checkClaimMedia(bucket.asBucket(), GAME_ID, key);

		expect(reads).toEqual([{ range: { offset: 0, length: 32 } }]);
	});

	it('refuses a key of another game without asking the bucket', async () => {
		const key = newMediaKey(GAME_ID + 1, 'image/jpeg');
		await bucket.put(key, SAMPLES['image/jpeg'], { httpMetadata: { contentType: 'image/jpeg' } });

		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(MEDIA_NOT_UPLOADED);
	});

	it.each([`${GAME_ID}/claims/../../secret.jpg`, `${GAME_ID}/abcdefghijklmnopqrstuv.jpg`])(
		'refuses the malformed key %s',
		async (key) => {
			expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(MEDIA_NOT_UPLOADED);
		}
	);

	it('refuses a key with nothing uploaded under it', async () => {
		const key = newMediaKey(GAME_ID, 'video/mp4');

		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(MEDIA_NOT_UPLOADED);
	});

	it('refuses a photo over the limit', async () => {
		const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
		big.set(SAMPLES['image/jpeg']);

		const key = await upload('image/jpeg', big);

		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(PHOTO_TOO_LARGE);
	});

	it('refuses an object stored with another content type than its key names', async () => {
		const key = await upload('image/jpeg', SAMPLES['image/jpeg'], 'text/html');

		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(NOT_MEDIA);
	});

	it('refuses bytes that are not what the key names', async () => {
		const key = await upload('image/jpeg', ascii('<script>alert(1)</script>'));

		expect(await checkClaimMedia(bucket.asBucket(), GAME_ID, key)).toBe(NOT_MEDIA);
	});
});

describe('mediaZipEntries', () => {
	const row = (fields: Partial<GameMediaRow> = {}): GameMediaRow => ({
		claim_id: 12,
		team_name: 'Canal Rats',
		challenge_title: 'Swim in a fountain',
		media_key: '7/claims/abcdefghijklmnopqrstuv.mp4',
		...fields
	});

	it('names each file by team folder, challenge and claim id, with the key extension', () => {
		expect(mediaZipEntries([row()])).toEqual([
			{ key: '7/claims/abcdefghijklmnopqrstuv.mp4', name: 'Canal Rats/Swim in a fountain-12.mp4' }
		]);
	});

	it('keeps names safe for file systems', () => {
		const [entry] = mediaZipEntries([
			row({ team_name: '../Rats', challenge_title: 'A/B: "c"?', claim_id: 3 })
		]);

		expect(entry.name).toBe('Rats/A B c-3.mp4');
	});

	it('skips a key that is not a media key', () => {
		expect(mediaZipEntries([row({ media_key: '7/claims/../../x.mp4' })])).toEqual([]);
	});
});

describe('gameMediaZip', () => {
	it('streams one zip of the game media, named after the game', async () => {
		const db = createTestDb();
		const bucket = new MemoryBucket();
		const game = await createGame(db, 'Canal hunt');
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		const swim = await seedChallenge(db, game.id, { title: 'Swim' });
		const key = newMediaKey(game.id, 'image/jpeg');
		await bucket.put(key, SAMPLES['image/jpeg']);
		const claim = await seedClaim(db, rats.id, swim.id, { media_key: key });
		await seedClaim(db, rats.id, swim.id, {
			status: 'rejected',
			media_key: newMediaKey(game.id, 'video/mp4')
		});

		const response = await gameMediaZip(db, bucket.asBucket(), game);

		expect(response.headers.get('Content-Type')).toBe('application/zip');
		expect(response.headers.get('Content-Disposition')).toBe(
			`attachment; filename="Canal hunt-media.zip"; filename*=UTF-8''Canal%20hunt-media.zip`
		);
		const zip = new Uint8Array(await response.arrayBuffer());
		const text = new TextDecoder('latin1').decode(zip);
		expect(text.startsWith('PK\x03\x04')).toBe(true);
		expect(text).toContain(`Canal Rats/Swim-${claim.id}.jpg`);
		expect(text).not.toContain('.mp4');
	});
});

describe('deleteAllMedia', () => {
	it('deletes every media object of the game and unlinks its claims', async () => {
		const db = createTestDb();
		const bucket = new MemoryBucket();
		const game = await createGame(db, 'Canal hunt');
		const other = await createGame(db, 'Other hunt');
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id);
		const key = newMediaKey(game.id, 'image/jpeg');
		const orphan = newMediaKey(game.id, 'video/mp4');
		const theirs = newMediaKey(other.id, 'image/jpeg');
		for (const stored of [key, orphan, theirs]) await bucket.put(stored, new Uint8Array(1));
		await seedClaim(db, rats.id, swim.id, { media_key: key });

		const outcome = await deleteAllMedia(db, bucket.asBucket(), game.id);

		expect(outcome).toEqual({ status: 200, result: { deleted: true } });
		expect(bucket.keys()).toEqual([theirs]);
		expect(await countGameMedia(db, game.id)).toBe(0);
	});
});
