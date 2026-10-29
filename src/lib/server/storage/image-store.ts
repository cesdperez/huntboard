import { generateToken } from '#lib/domain/token.js';
import { deleteObjects } from './bucket-objects.js';

/** The formats the browser resizer produces. Anything else was not resized by this app. */
export type ImageType = 'image/webp' | 'image/jpeg';

export interface ImageUpload {
	bytes: Uint8Array<ArrayBuffer>;
	contentType: ImageType;
}

export type ImageBucket = Pick<R2Bucket, 'put' | 'get' | 'delete' | 'list'>;

/** The previous key a commit replaced, or null when there was nothing to attach the image to. */
export type ImageCommit = (key: string) => Promise<{ previous: string | null } | null>;

const EXTENSIONS: Record<ImageType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };
const TYPES_BY_EXTENSION: Record<string, ImageType> = { webp: 'image/webp', jpg: 'image/jpeg' };
const IMAGE_KEY = /^[1-9]\d*\/[A-Za-z0-9_-]{22}\.(webp|jpg)$/;
// Safe because a replaced object gets a new key: no URL ever shows different bytes.
export const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Keys start with the game id, so resetting a game can sweep its images by prefix. */
export function newImageKey(gameId: number, type: ImageType): string {
	return `${gameId}/${generateToken()}.${EXTENSIONS[type]}`;
}

export function isImageKey(key: string): boolean {
	return IMAGE_KEY.test(key);
}

/**
 * Stores the upload under a new key, then lets commit point the database at it. The object goes
 * again when commit finds nothing to attach it to or throws, so a failure leaves no orphan.
 */
export async function replaceImage(
	bucket: ImageBucket,
	gameId: number,
	upload: ImageUpload,
	commit: ImageCommit
): Promise<boolean> {
	const key = newImageKey(gameId, upload.contentType);
	await bucket.put(key, upload.bytes, { httpMetadata: { contentType: upload.contentType } });

	let committed: Awaited<ReturnType<ImageCommit>>;
	try {
		committed = await commit(key);
	} catch (error) {
		await deleteObjects(bucket, [key]);
		throw error;
	}
	if (!committed) {
		await deleteObjects(bucket, [key]);
		return false;
	}
	await deleteObjects(bucket, [committed.previous]);
	return true;
}

export async function imageResponse(bucket: ImageBucket, key: string): Promise<Response> {
	const object = isImageKey(key) ? await bucket.get(key) : null;
	if (!object || !('body' in object)) {
		return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	}
	const extension = key.slice(key.lastIndexOf('.') + 1);
	return new Response(object.body, {
		headers: {
			'Content-Type': TYPES_BY_EXTENSION[extension],
			'Cache-Control': IMMUTABLE,
			ETag: object.httpEtag
		}
	});
}
