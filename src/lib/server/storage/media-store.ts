import { MEDIA_EXTENSIONS, mediaKeyType, type MediaType } from '#lib/domain/claim-media.js';
import { generateToken } from '#lib/domain/token.js';
import { IMMUTABLE } from './image-store.js';

export type MediaBucket = Pick<R2Bucket, 'put' | 'get' | 'head' | 'delete' | 'list'>;

/** Keys start with the game id, so the game's sweep covers them, and the random name is the secret. */
export function newMediaKey(gameId: number, type: MediaType): string {
	return `${gameId}/claims/${generateToken()}.${MEDIA_EXTENSIONS[type]}`;
}

export interface ByteRange {
	offset: number;
	length: number;
}

const RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * The one byte range a Range header asks for. Null means serve the whole object, which HTTP
 * allows for headers it cannot or will not honour, such as several ranges.
 */
export function parseRange(
	header: string | null,
	size: number
): ByteRange | 'unsatisfiable' | null {
	const match = header ? RANGE.exec(header.trim()) : null;
	if (!match || (match[1] === '' && match[2] === '')) return null;

	if (match[1] === '') {
		const suffix = Number(match[2]);
		if (suffix === 0 || size === 0) return 'unsatisfiable';
		const offset = Math.max(0, size - suffix);
		return { offset, length: size - offset };
	}
	const offset = Number(match[1]);
	const last = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
	if (offset >= size) return 'unsatisfiable';
	if (last < offset) return null;
	return { offset, length: last - offset + 1 };
}

/** Serves a claim's media, honouring one byte range: iOS Safari plays no video without it. */
export async function mediaResponse(
	bucket: MediaBucket,
	key: string,
	rangeHeader: string | null
): Promise<Response> {
	const type = mediaKeyType(key);
	if (type === null) return notFound();

	if (rangeHeader) {
		const head = await bucket.head(key);
		if (!head) return notFound();
		const range = parseRange(rangeHeader, head.size);
		if (range === 'unsatisfiable') {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${head.size}`, 'Cache-Control': 'no-store' }
			});
		}
		if (range) {
			const object = await bucket.get(key, { range });
			if (!object) return notFound();
			const last = range.offset + range.length - 1;
			return new Response(object.body, {
				status: 206,
				headers: {
					...mediaHeaders(type, object.httpEtag, range.length),
					'Content-Range': `bytes ${range.offset}-${last}/${object.size}`
				}
			});
		}
	}

	const object = await bucket.get(key);
	if (!object) return notFound();
	return new Response(object.body, { headers: mediaHeaders(type, object.httpEtag, object.size) });
}

function mediaHeaders(type: MediaType, etag: string, length: number): Record<string, string> {
	return {
		'Content-Type': type,
		'Content-Length': String(length),
		'Accept-Ranges': 'bytes',
		'Cache-Control': IMMUTABLE,
		ETag: etag
	};
}

function notFound(): Response {
	return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
