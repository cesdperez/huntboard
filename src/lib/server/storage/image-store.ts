import { generateToken } from '#lib/domain/token.js';
import type { ImageType, ImageUpload } from '../http/image-upload.js';

export type ImageBucket = Pick<R2Bucket, 'put' | 'get' | 'delete' | 'list'>;

/** The previous key a commit replaced, or null when there was nothing to attach the image to. */
export type ImageCommit = (key: string) => Promise<{ previous: string | null } | null>;

const EXTENSIONS: Record<ImageType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };
const TYPES_BY_EXTENSION: Record<string, ImageType> = { webp: 'image/webp', jpg: 'image/jpeg' };
const MAX_KEYS_PER_DELETE = 1000;
const IMAGE_KEY = /^[1-9]\d*\/[A-Za-z0-9_-]{22}\.(webp|jpg)$/;
// Safe because a replaced image gets a new key: no URL ever shows different bytes.
const IMMUTABLE = 'public, max-age=31536000, immutable';

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
		await deleteImages(bucket, [key]);
		throw error;
	}
	if (!committed) {
		await deleteImages(bucket, [key]);
		return false;
	}
	await deleteImages(bucket, [committed.previous]);
	return true;
}

/**
 * Best effort: the database no longer points at these keys, so a failed delete leaves an
 * unreachable object, which the next reset of the game sweeps.
 */
export async function deleteImages(bucket: ImageBucket, keys: (string | null)[]): Promise<void> {
	const present = keys.filter((key) => key !== null);
	if (present.length === 0) return;
	try {
		await bucket.delete(present);
	} catch (error) {
		console.error('Deleting images failed', present, error);
	}
}

/** Deletes every image stored for the game, including any a failed delete left behind. */
export async function deleteGameImages(bucket: ImageBucket, gameId: number): Promise<void> {
	const keys: string[] = [];
	let cursor: string | undefined;
	// Lists everything before deleting, so deleting cannot shift the pages still to come.
	do {
		const page = await bucket.list({ prefix: `${gameId}/`, cursor });
		keys.push(...page.objects.map((object) => object.key));
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	for (let start = 0; start < keys.length; start += MAX_KEYS_PER_DELETE) {
		await deleteImages(bucket, keys.slice(start, start + MAX_KEYS_PER_DELETE));
	}
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
