import { describe, expect, it } from 'vitest';
import { r2Presigner, UPLOAD_URL_SECONDS } from './media-upload.js';

const NOW = new Date('2026-06-01T18:00:00.000Z');

describe('r2Presigner', () => {
	const presign = r2Presigner({ accessKeyId: 'AKID', secretAccessKey: 'secret' });

	it('signs a PUT of one key in the media bucket, with its type and size, for 15 minutes', async () => {
		const target = await presign('3/claims/abcdefghijklmnopqrstuv.mp4', 'video/mp4', 1234, NOW);

		const url = new URL(target.url);
		expect(url.origin).toMatch(/^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/);
		expect(url.pathname).toBe('/huntboard-media/3/claims/abcdefghijklmnopqrstuv.mp4');
		expect(UPLOAD_URL_SECONDS).toBe(900);
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			'X-Amz-Expires': '900',
			'X-Amz-Date': '20260601T180000Z',
			'X-Amz-Credential': 'AKID/20260601/auto/s3/aws4_request',
			'X-Amz-SignedHeaders': 'content-length;content-type;host',
			'X-Amz-Signature': expect.stringMatching(/^[0-9a-f]{64}$/)
		});
		expect(target.headers).toEqual({ 'Content-Type': 'video/mp4' });
	});

	it('signs a different URL for a different size, so R2 refuses any other body', async () => {
		const key = '3/claims/abcdefghijklmnopqrstuv.mp4';

		const one = await presign(key, 'video/mp4', 1234, NOW);
		const other = await presign(key, 'video/mp4', 1235, NOW);

		expect(one.url).not.toBe(other.url);
	});
});
