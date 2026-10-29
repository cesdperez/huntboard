import { beforeEach, describe, expect, it } from 'vitest';
import { newMediaKey } from './media-store.js';
import { devPresigner, storeDevUpload } from './dev-media-upload.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const NOW = new Date('2026-06-01T18:00:00.000Z');
const WEBM = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4);

let bucket: MemoryBucket;
let key: string;

beforeEach(() => {
	bucket = new MemoryBucket();
	key = newMediaKey(3, 'video/webm');
});

async function put(
	url: string,
	{ body = WEBM, type = 'video/webm', length = String(body.length) } = {}
) {
	const request = new Request(new URL(url, 'http://localhost:5173'), {
		method: 'PUT',
		headers: { 'Content-Type': type, 'Content-Length': length },
		body
	});
	const path = new URL(request.url).pathname.replace('/dev/media/', '');
	return storeDevUpload(bucket.asBucket(), request, path, NOW);
}

describe('devPresigner and storeDevUpload', () => {
	it('signs a same-origin URL that stores exactly the presigned upload', async () => {
		const target = await devPresigner(key, 'video/webm', WEBM.length, NOW);

		expect(target.url).toMatch(new RegExp(`^/dev/media/${key}\\?`));
		expect(target.headers).toEqual({ 'Content-Type': 'video/webm' });
		const response = await put(target.url);

		expect(response.status).toBe(200);
		expect(bucket.objects.get(key)).toMatchObject({ bytes: WEBM, contentType: 'video/webm' });
	});

	it('refuses another content type than the one presigned', async () => {
		const target = await devPresigner(key, 'video/webm', WEBM.length, NOW);

		expect((await put(target.url, { type: 'text/html' })).status).toBe(403);
		expect(bucket.keys()).toEqual([]);
	});

	it('refuses another size than the one presigned', async () => {
		const target = await devPresigner(key, 'video/webm', WEBM.length, NOW);
		const body = Uint8Array.of(...WEBM, 5);

		expect((await put(target.url, { body })).status).toBe(403);
		expect(bucket.keys()).toEqual([]);
	});

	it('refuses a URL signed for another key', async () => {
		const target = await devPresigner(key, 'video/webm', WEBM.length, NOW);
		const other = newMediaKey(3, 'video/webm');

		expect((await put(target.url.replace(key, other))).status).toBe(403);
	});

	it('refuses an expired URL', async () => {
		const target = await devPresigner(key, 'video/webm', WEBM.length, new Date(+NOW - 16 * 60_000));

		expect((await put(target.url)).status).toBe(403);
	});

	it('refuses a key that is not a media key', async () => {
		const target = await devPresigner('3/../x.webm', 'video/webm', WEBM.length, NOW);

		expect((await put(target.url)).status).toBe(403);
	});

	it('refuses an unsigned URL', async () => {
		expect((await put(`/dev/media/${key}`)).status).toBe(403);
		expect(bucket.keys()).toEqual([]);
	});
});
