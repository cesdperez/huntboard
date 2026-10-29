import { beforeEach, describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, type MediaType } from '#lib/domain/claim-media.js';
import { newMediaKey } from '../storage/media-store.js';
import { MemoryBucket } from '../testing/memory-bucket.js';
import {
	MEDIA_NOT_UPLOADED,
	NOT_MEDIA,
	PHOTO_TOO_LARGE,
	checkClaimMedia,
	matchesMediaType
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
