import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	imageResponse,
	isImageKey,
	newImageKey,
	replaceImage,
	type ImageUpload
} from './image-store.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const WEBP_UPLOAD: ImageUpload = {
	bytes: new TextEncoder().encode('RIFF\x24\x00\x00\x00WEBPVP8 '),
	contentType: 'image/webp'
};

let bucket: MemoryBucket;

beforeEach(() => {
	bucket = new MemoryBucket();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('newImageKey', () => {
	it('puts a random name under the game id, with the extension of its type', () => {
		expect(newImageKey(12, 'image/webp')).toMatch(/^12\/[A-Za-z0-9_-]{22}\.webp$/);
		expect(newImageKey(12, 'image/jpeg')).toMatch(/^12\/[A-Za-z0-9_-]{22}\.jpg$/);
	});

	it('never repeats, so a replaced image never shows from a cache', () => {
		expect(newImageKey(1, 'image/webp')).not.toBe(newImageKey(1, 'image/webp'));
	});
});

describe('isImageKey', () => {
	it('accepts the keys newImageKey makes', () => {
		expect(isImageKey(newImageKey(7, 'image/jpeg'))).toBe(true);
	});

	it.each([
		'7/../secret.webp',
		'7/abcdefghijklmnopqrstuv.png',
		'7/short.webp',
		'x/abcdefghijklmnopqrstuv.webp',
		'07/abcdefghijklmnopqrstuv.webp',
		'7/abcdefghijklmnopqrstuv.webp/more'
	])('refuses %s', (key) => {
		expect(isImageKey(key)).toBe(false);
	});
});

describe('replaceImage', () => {
	it('stores the image with its content type and deletes the one it replaced', async () => {
		await bucket.put('3/oldoldoldoldoldoldoldo.webp', new Uint8Array());
		let committed: string | null = null;

		const stored = await replaceImage(bucket.asBucket(), 3, WEBP_UPLOAD, async (key) => {
			committed = key;
			return { previous: '3/oldoldoldoldoldoldoldo.webp' };
		});

		expect(stored).toBe(true);
		expect(bucket.keys()).toEqual([committed]);
		expect(bucket.objects.get(committed!)).toMatchObject({
			bytes: WEBP_UPLOAD.bytes,
			contentType: 'image/webp'
		});
	});

	it('deletes the new image when there was nothing to attach it to', async () => {
		const stored = await replaceImage(bucket.asBucket(), 3, WEBP_UPLOAD, async () => null);

		expect(stored).toBe(false);
		expect(bucket.keys()).toEqual([]);
	});

	it('deletes the new image and rethrows when saving its key fails', async () => {
		const failure = new Error('D1 is down');

		await expect(
			replaceImage(bucket.asBucket(), 3, WEBP_UPLOAD, async () => {
				throw failure;
			})
		).rejects.toBe(failure);
		expect(bucket.keys()).toEqual([]);
	});

	it('still succeeds when deleting the old image fails', async () => {
		bucket.failDeletes = true;

		const stored = await replaceImage(bucket.asBucket(), 3, WEBP_UPLOAD, async () => ({
			previous: '3/oldoldoldoldoldoldoldo.webp'
		}));

		expect(stored).toBe(true);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('imageResponse', () => {
	it('streams a stored image with its type and a cache lifetime of a year', async () => {
		const key = newImageKey(4, 'image/webp');
		await bucket.put(key, WEBP_UPLOAD.bytes, { httpMetadata: { contentType: 'image/webp' } });

		const response = await imageResponse(bucket.asBucket(), key);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/webp');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(WEBP_UPLOAD.bytes);
	});

	it('answers 404 for a key that is not stored', async () => {
		const response = await imageResponse(bucket.asBucket(), newImageKey(4, 'image/jpeg'));

		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it('answers 404 for a malformed key without asking the bucket', async () => {
		const get = vi.spyOn(bucket, 'get');

		const response = await imageResponse(bucket.asBucket(), '4/../../etc/passwd');

		expect(response.status).toBe(404);
		expect(get).not.toHaveBeenCalled();
	});
});
