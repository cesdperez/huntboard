import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaResponse, newMediaKey, parseRange } from './media-store.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

describe('newMediaKey', () => {
	it('puts a random name under the game claims, with the extension of its type', () => {
		expect(newMediaKey(12, 'video/quicktime')).toMatch(/^12\/claims\/[A-Za-z0-9_-]{22}\.mov$/);
		expect(newMediaKey(12, 'image/jpeg')).not.toBe(newMediaKey(12, 'image/jpeg'));
	});
});

describe('parseRange', () => {
	it.each([
		['bytes=0-99', { offset: 0, length: 100 }],
		['bytes=900-', { offset: 900, length: 100 }],
		['bytes=-100', { offset: 900, length: 100 }],
		['bytes=-5000', { offset: 0, length: 1000 }],
		['bytes=990-5000', { offset: 990, length: 10 }],
		['bytes=0-0', { offset: 0, length: 1 }]
	])('reads %s of 1000 bytes', (header, range) => {
		expect(parseRange(header, 1000)).toEqual(range);
	});

	it.each(['bytes=1000-', 'bytes=1000-1001', 'bytes=-0'])(
		'finds %s unsatisfiable on 1000 bytes',
		(header) => {
			expect(parseRange(header, 1000)).toBe('unsatisfiable');
		}
	);

	it.each([null, '', 'bytes=-', 'bytes=5-2', 'bytes=0-1,5-6', 'items=0-1', 'bytes=a-b'])(
		'ignores %j, so the whole object is served',
		(header) => {
			expect(parseRange(header, 1000)).toBeNull();
		}
	);
});

describe('mediaResponse', () => {
	const BYTES = Uint8Array.from({ length: 100 }, (_, index) => index);
	let bucket: MemoryBucket;
	let key: string;

	beforeEach(async () => {
		bucket = new MemoryBucket();
		key = newMediaKey(4, 'video/mp4');
		await bucket.put(key, BYTES, { httpMetadata: { contentType: 'video/mp4' } });
	});

	it('streams the whole object with its type, its length and a cache lifetime of a year', async () => {
		const response = await mediaResponse(bucket.asBucket(), key, null);

		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			'content-type': 'video/mp4',
			'content-length': '100',
			'accept-ranges': 'bytes',
			'cache-control': 'public, max-age=31536000, immutable'
		});
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
	});

	it('serves a byte range as 206, which iOS needs to play video', async () => {
		const response = await mediaResponse(bucket.asBucket(), key, 'bytes=10-19');

		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe('bytes 10-19/100');
		expect(response.headers.get('Content-Length')).toBe('10');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES.slice(10, 20));
	});

	it('answers 416 with the size for a range past the end', async () => {
		const response = await mediaResponse(bucket.asBucket(), key, 'bytes=100-');

		expect(response.status).toBe(416);
		expect(response.headers.get('Content-Range')).toBe('bytes */100');
	});

	it('takes the type from the key, not from what was stored', async () => {
		const photo = newMediaKey(4, 'image/webp');
		await bucket.put(photo, BYTES, { httpMetadata: { contentType: 'text/html' } });

		const response = await mediaResponse(bucket.asBucket(), photo, null);

		expect(response.headers.get('Content-Type')).toBe('image/webp');
	});

	it.each([null, 'bytes=0-1'])(
		'answers 404 for a key that is not stored, range %j',
		async (range) => {
			const response = await mediaResponse(bucket.asBucket(), newMediaKey(4, 'image/jpeg'), range);

			expect(response.status).toBe(404);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		}
	);

	it('answers 404 for a malformed key without asking the bucket', async () => {
		const get = vi.spyOn(bucket, 'get');
		const head = vi.spyOn(bucket, 'head');

		const response = await mediaResponse(bucket.asBucket(), '4/claims/../../x.mp4', 'bytes=0-1');

		expect(response.status).toBe(404);
		expect(get).not.toHaveBeenCalled();
		expect(head).not.toHaveBeenCalled();
	});
});
