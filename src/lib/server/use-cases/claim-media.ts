import {
	isVideoType,
	MEDIA_EXTENSIONS,
	maxMediaBytes,
	mediaKeyType,
	type MediaType
} from '#lib/domain/claim-media.js';
import { safeFileName } from '#lib/format/file-name.js';
import type { ActionOutcome } from './action-outcome.js';
import { clearGameMedia, listGameMedia, type GameMediaRow } from '../db/claim-media.js';
import { clearGameUploads } from '../db/media-uploads.js';
import type { GameRow } from '../db/types.js';
import { deleteGameObjects } from '../storage/bucket-objects.js';
import { mediaZipResponse, type MediaBucket, type ZipEntry } from '../storage/media-store.js';
import { sniffImageType, startsWith } from './image-upload.js';

/** What the media actions put under page.form.media. */
export interface MediaFormResult {
	deleted: true;
}

export const MEDIA_NOT_UPLOADED = 'This photo or video did not finish uploading. Attach it again.';
export const PHOTO_TOO_LARGE = 'This photo is too large. Choose a smaller one.';
export const VIDEO_TOO_LARGE = 'This video is too large. Choose a shorter one.';
export const NOT_MEDIA =
	'This file is not a photo or video the app takes. Choose a JPEG or WebP photo, or an MP4, MOV or WebM video.';

const SNIFF_BYTES = 32;
// QuickTime files from older cameras lead with one of these atoms instead of ftyp.
const ISO_FIRST_ATOMS = ['ftyp', 'moov', 'mdat', 'wide', 'free'].map((atom) =>
	new TextEncoder().encode(atom)
);
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
			return ISO_FIRST_ATOMS.some((atom) => startsWith(bytes, atom, 4));
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

	// A ranged read still reports the whole object's size and metadata.
	const start = await bucket.get(key, { range: { offset: 0, length: SNIFF_BYTES } });
	if (!start) return MEDIA_NOT_UPLOADED;
	if (start.size > maxMediaBytes(type)) return mediaTooLarge(type);
	// The media route serves the type the key names, so the bytes must be that type too.
	if (start.httpMetadata?.contentType !== type) return NOT_MEDIA;

	const bytes = new Uint8Array(await new Response(start.body).arrayBuffer());
	return matchesMediaType(bytes, type) ? null : NOT_MEDIA;
}

/** Zip paths `<team>/<challenge>-<claim id>.<ext>`: the claim id keeps every path unique. */
export function mediaZipEntries(rows: GameMediaRow[]): ZipEntry[] {
	return rows.flatMap((row) => {
		const type = mediaKeyType(row.media_key);
		if (type === null) return [];
		const team = safeFileName(row.team_name, 'Team');
		const challenge = safeFileName(row.challenge_title, 'Challenge', 60);
		const name = `${team}/${challenge}-${row.claim_id}.${MEDIA_EXTENSIONS[type]}`;
		return [{ key: row.media_key, name }];
	});
}

/** Every claim's media in the game, any status, as one zip download. */
export async function gameMediaZip(
	db: D1Database,
	bucket: MediaBucket,
	game: GameRow
): Promise<Response> {
	const entries = mediaZipEntries(await listGameMedia(db, game.id));
	return mediaZipResponse(bucket, `${safeFileName(game.name, 'Huntboard')}-media.zip`, entries);
}

/** Unlinks the claims first, so no claim ever points at a deleted object. The sweep takes orphans too. */
export async function deleteAllMedia(
	db: D1Database,
	bucket: MediaBucket,
	gameId: number
): Promise<ActionOutcome<MediaFormResult>> {
	await clearGameMedia(db, gameId);
	await clearGameUploads(db, gameId);
	await deleteGameObjects(bucket, gameId);
	return { status: 200, result: { deleted: true } };
}
