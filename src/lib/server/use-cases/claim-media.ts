import {
	isVideoType,
	maxMediaBytes,
	mediaKeyType,
	type MediaType
} from '#lib/domain/claim-media.js';
import type { MediaBucket } from '../storage/media-store.js';
import { sniffImageType, startsWith } from './image-upload.js';

export const MEDIA_NOT_UPLOADED = 'This photo or video did not finish uploading. Attach it again.';
export const PHOTO_TOO_LARGE = 'This photo is too large. Choose a smaller one.';
export const VIDEO_TOO_LARGE = 'This video is too large. Choose a shorter one.';
export const NOT_MEDIA =
	'This file is not a photo or video the app takes. Choose a JPEG or WebP photo, or an MP4, MOV or WebM video.';

const SNIFF_BYTES = 32;
const FTYP = new TextEncoder().encode('ftyp');
const EBML = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3);

export function mediaTooLarge(type: MediaType): string {
	return isVideoType(type) ? VIDEO_TOO_LARGE : PHOTO_TOO_LARGE;
}

/** Whether the first bytes of a file are the type it claims to be. */
export function matchesMediaType(bytes: Uint8Array, type: MediaType): boolean {
	switch (type) {
		case 'image/jpeg':
		case 'image/webp':
			return sniffImageType(bytes) === type;
		// Phones label the same ISO media container either way, so the brand is not checked.
		case 'video/mp4':
		case 'video/quicktime':
			return startsWith(bytes, FTYP, 4);
		case 'video/webm':
			return startsWith(bytes, EBML, 0);
	}
}

/**
 * Checks the object a team uploaded before a claim points at it: under this game, within the
 * size limit, stored with the type its key names, and starting with that type's magic bytes.
 * Returns the message to show, or null when the media is fine.
 */
export async function checkClaimMedia(
	bucket: MediaBucket,
	gameId: number,
	key: string
): Promise<string | null> {
	const type = key.startsWith(`${gameId}/`) ? mediaKeyType(key) : null;
	if (type === null) return MEDIA_NOT_UPLOADED;

	const head = await bucket.head(key);
	if (!head) return MEDIA_NOT_UPLOADED;
	if (head.size > maxMediaBytes(type)) return mediaTooLarge(type);
	// The media route serves the type the key names, so the bytes must be that type too.
	if (head.httpMetadata?.contentType !== type) return NOT_MEDIA;

	const start = await bucket.get(key, { range: { offset: 0, length: SNIFF_BYTES } });
	if (!start) return MEDIA_NOT_UPLOADED;
	const bytes = new Uint8Array(await new Response(start.body).arrayBuffer());
	return matchesMediaType(bytes, type) ? null : NOT_MEDIA;
}
