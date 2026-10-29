import { downloadZip } from 'client-zip';
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

export interface ZipEntry {
	key: string;
	/** The path inside the zip. */
	name: string;
}

/**
 * Streams one store-only zip of the entries, reading one object at a time, so memory stays flat
 * however large the media. An object that is gone, such as one the lifecycle rule expired, is left out.
 */
export function mediaZipResponse(bucket: MediaBucket, fileName: string, entries: ZipEntry[]) {
	const zip = downloadZip(zipInputs(bucket, entries));
	return new Response(zip.body, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': attachment(fileName),
			'Cache-Control': 'no-store'
		}
	});
}

async function* zipInputs(bucket: MediaBucket, entries: ZipEntry[]) {
	for (const { key, name } of entries) {
		const object = await bucket.get(key);
		if (object)
			yield { name, input: object.body, size: object.size, lastModified: object.uploaded };
	}
}

// The plain filename is for old clients; filename* carries the name as typed.
function attachment(fileName: string): string {
	const ascii = fileName.replace(/[^\x20-\x7e]|"/g, '_');
	const encoded = encodeURIComponent(fileName).replace(
		/['()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
	);
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
