/** Limits shared by the browser, which compresses before upload, and the server, which checks the result. */
export const PHOTO_LONG_EDGE = 1600;
export const PHOTO_MAX_BYTES = 512 * 1024;

export const VIDEO_HEIGHT = 720;
export const VIDEO_BITRATE = 2_000_000;
export const VIDEO_MAX_SECONDS = 60;
// 60 s at 2 Mbps plus audio is about 16 MB.
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
/** For phones that cannot re-encode, so the original goes up as recorded. */
export const ORIGINAL_VIDEO_MAX_BYTES = 80 * 1024 * 1024;

export type PhotoType = 'image/jpeg' | 'image/webp';
export type VideoType = 'video/mp4' | 'video/quicktime' | 'video/webm';
export type MediaType = PhotoType | VideoType;

export const MEDIA_EXTENSIONS: Record<MediaType, string> = {
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm'
};

export function isMediaType(value: unknown): value is MediaType {
	return typeof value === 'string' && Object.hasOwn(MEDIA_EXTENSIONS, value);
}

export function isVideoType(type: MediaType): type is VideoType {
	return type.startsWith('video/');
}

/** The largest object the server accepts for a type. Videos allow the original size, since re-encoding is optional. */
export function maxMediaBytes(type: MediaType): number {
	return isVideoType(type) ? ORIGINAL_VIDEO_MAX_BYTES : PHOTO_MAX_BYTES;
}

export function mediaSrc(key: string): string {
	return `/media/${key}`;
}

export type MediaKind = 'photo' | 'video';

/** Claim media as the team and the judges see it. */
export interface ClaimMedia {
	src: string;
	kind: MediaKind;
}

const TYPES_BY_EXTENSION = new Map(
	Object.entries(MEDIA_EXTENSIONS).map(([type, extension]) => [extension, type as MediaType])
);
const MEDIA_KEY = /^[1-9]\d*\/claims\/[A-Za-z0-9_-]{22}\.([a-z0-9]+)$/;

/** The type a claim media key's extension names, or null for anything that is not one. */
export function mediaKeyType(key: string): MediaType | null {
	const extension = MEDIA_KEY.exec(key)?.[1];
	return (extension && TYPES_BY_EXTENSION.get(extension)) || null;
}

export function claimMedia(key: string | null): ClaimMedia | null {
	const type = key === null ? null : mediaKeyType(key);
	if (key === null || type === null) return null;
	return { src: mediaSrc(key), kind: isVideoType(type) ? 'video' : 'photo' };
}
