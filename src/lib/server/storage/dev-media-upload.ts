import { isMediaType, mediaKeyType } from '#lib/domain/claim-media.js';
import { encodeBase64Url } from '#lib/domain/token.js';
import type { MediaBucket } from './media-store.js';
import { UPLOAD_URL_SECONDS, type MediaPresigner } from './media-upload.js';

/**
 * `pnpm dev` has no R2 S3 endpoint, so uploads go to this same-origin route instead, which
 * answers only in dev. The request guard lets its bodies past the size limit there.
 */
export const DEV_MEDIA_PATH = '/dev/media/';

// Per process: a restart only invalidates URLs that expire within minutes anyway.
let signingKey: Promise<CryptoKey> | undefined;

/** Signs what an R2 presigned URL does: this key, type and size, for UPLOAD_URL_SECONDS. */
export const devPresigner: MediaPresigner = async (key, type, size, now) => {
	const expires = String(Math.floor(now.getTime() / 1000) + UPLOAD_URL_SECONDS);
	const signature = await sign([key, type, String(size), expires]);
	const query = new URLSearchParams({ type, size: String(size), expires, signature });
	return { url: `${DEV_MEDIA_PATH}${key}?${query}`, headers: { 'Content-Type': type } };
};

/** Stores a PUT to a URL from devPresigner, refusing anything it did not sign. */
export async function storeDevUpload(
	bucket: MediaBucket,
	request: Request,
	key: string,
	now: Date
): Promise<Response> {
	const query = new URL(request.url).searchParams;
	const [type, size, expires, signature] = ['type', 'size', 'expires', 'signature'].map(
		(name) => query.get(name) ?? ''
	);
	const valid =
		mediaKeyType(key) !== null &&
		isMediaType(type) &&
		request.headers.get('Content-Type') === type &&
		request.headers.get('Content-Length') === size &&
		Number(expires) * 1000 > now.getTime() &&
		signature === (await sign([key, type, size, expires]));
	if (!valid) return new Response('Forbidden', { status: 403 });

	const bytes = new Uint8Array(await request.arrayBuffer());
	if (String(bytes.length) !== size) return new Response('Forbidden', { status: 403 });
	await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
	return new Response(null, { status: 200 });
}

async function sign(fields: string[]): Promise<string> {
	signingKey ??= crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const message = new TextEncoder().encode(fields.join('\n'));
	const mac = await crypto.subtle.sign('HMAC', await signingKey, message);
	return encodeBase64Url(new Uint8Array(mac));
}
