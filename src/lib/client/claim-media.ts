import type { AudioCodec, Conversion, Input, VideoCodec } from 'mediabunny';
import {
	MEDIA_EXTENSIONS,
	ORIGINAL_VIDEO_MAX_BYTES,
	PHOTO_LONG_EDGE,
	PHOTO_MAX_BYTES,
	VIDEO_BITRATE,
	VIDEO_HEIGHT,
	VIDEO_MAX_BYTES,
	VIDEO_MAX_SECONDS,
	type MediaType,
	type PhotoType,
	type VideoType
} from '../domain/claim-media.js';
import { resizeImage, type ImageSpec } from './image-resize.js';

export const CLAIM_PHOTO_SPEC: ImageSpec = {
	shape: 'fit',
	size: PHOTO_LONG_EDGE,
	maxBytes: PHOTO_MAX_BYTES
};

export const NOT_MEDIA = 'Choose a photo or a video.';
export const VIDEO_TOO_LONG = `This video is longer than ${VIDEO_MAX_SECONDS} seconds. Trim it and try again.`;
export const VIDEO_TOO_LARGE =
	'This video is too large to send from this phone. Send a shorter one.';
export const COMPRESSED_VIDEO_TOO_LARGE =
	'This video stays too large even when compressed. Send a shorter one.';
export const UNSUPPORTED_VIDEO =
	'This phone cannot convert this video. Send an MP4, MOV or WebM video.';
export const UNREADABLE_VIDEO =
	'This file is not a video this browser can read. Choose an MP4, MOV or WebM video.';

export type PreparedMedia =
	{ ok: true; file: File; type: MediaType } | { ok: false; message: string };

export interface VideoProbe {
	seconds: number;
	videoCodec: VideoCodec | null;
	audioCodec: AudioCodec | null;
	/** Display size, after rotation. */
	width: number;
	height: number;
}

const AUDIO_BITRATE = 128_000;
// Metadata durations run a little over what the camera showed.
const DURATION_SLACK_SECONDS = 0.5;

const EXTENSION_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	heic: 'image/heic',
	heif: 'image/heif',
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm'
};

const ORIGINAL_VIDEO_TYPES: readonly string[] = ['video/mp4', 'video/quicktime', 'video/webm'];

/**
 * Shrinks a photo or re-encodes a video in the browser so it fits the upload limits.
 * Rejects with the signal's reason when aborted.
 */
export async function prepareClaimMedia(
	file: File,
	onProgress: (fraction: number) => void,
	signal?: AbortSignal
): Promise<PreparedMedia> {
	switch (classifyMedia(file)) {
		case 'photo':
			return preparePhoto(file);
		case 'video':
			return prepareVideo(file, onProgress, signal);
		default:
			return { ok: false, message: NOT_MEDIA };
	}
}

export function classifyMedia(file: File): 'photo' | 'video' | null {
	const type = mediaTypeOf(file);
	if (type.startsWith('image/')) return 'photo';
	if (type.startsWith('video/')) return 'video';
	return null;
}

/** Scales the short edge to at most VIDEO_HEIGHT, so portrait phone clips get 720p too. Never scales up. */
export function videoTargetSize(width: number, height: number): { width: number; height: number } {
	const scale = Math.min(1, VIDEO_HEIGHT / Math.min(width, height));
	return { width: even(width * scale), height: even(height * scale) };
}

export function isTooLong(seconds: number): boolean {
	return seconds > VIDEO_MAX_SECONDS + DURATION_SLACK_SECONDS;
}

/** True when the file already plays everywhere and fits the budget, so re-encoding would only cost time. */
export function canPassThrough(file: File, probe: VideoProbe): boolean {
	const bitrate = (file.size * 8) / probe.seconds;
	return (
		mediaTypeOf(file) === 'video/mp4' &&
		probe.videoCodec === 'avc' &&
		(probe.audioCodec === null || probe.audioCodec === 'aac') &&
		Math.min(probe.width, probe.height) <= VIDEO_HEIGHT &&
		file.size <= VIDEO_MAX_BYTES &&
		bitrate <= VIDEO_BITRATE + AUDIO_BITRATE
	);
}

/** The video as recorded, for browsers that cannot re-encode it. */
export function originalVideo(file: File): PreparedMedia {
	const type = mediaTypeOf(file);
	if (!ORIGINAL_VIDEO_TYPES.includes(type)) return { ok: false, message: UNSUPPORTED_VIDEO };
	if (file.size > ORIGINAL_VIDEO_MAX_BYTES) return { ok: false, message: VIDEO_TOO_LARGE };
	const typed = file.type === type ? file : new File([file], file.name, { type });
	return { ok: true, file: typed, type: type as VideoType };
}

export function compressedVideo(buffer: ArrayBuffer): PreparedMedia {
	if (buffer.byteLength > VIDEO_MAX_BYTES)
		return { ok: false, message: COMPRESSED_VIDEO_TOO_LARGE };
	const type: VideoType = 'video/mp4';
	return { ok: true, file: new File([buffer], `video.${MEDIA_EXTENSIONS[type]}`, { type }), type };
}

export async function probeVideo(input: Input): Promise<VideoProbe | null> {
	const video = await input.getPrimaryVideoTrack();
	if (!video) return null;
	const audio = await input.getPrimaryAudioTrack();
	const seconds = (await input.getDurationFromMetadata()) ?? (await input.computeDuration());
	return {
		seconds,
		videoCodec: video.codec,
		audioCodec: audio?.codec ?? null,
		width: await video.getDisplayWidth(),
		height: await video.getDisplayHeight()
	};
}

async function prepareVideo(
	file: File,
	onProgress: (fraction: number) => void,
	signal?: AbortSignal
): Promise<PreparedMedia> {
	// Loaded here so pages stay light for teams that only send photos.
	const mediabunny = await import('mediabunny');
	const input = new mediabunny.Input({
		source: new mediabunny.BlobSource(file),
		formats: mediabunny.ALL_FORMATS
	});
	try {
		const probe = await probeVideo(input).catch(() => null);
		signal?.throwIfAborted();
		if (!probe) return { ok: false, message: UNREADABLE_VIDEO };
		if (isTooLong(probe.seconds)) return { ok: false, message: VIDEO_TOO_LONG };
		if (canPassThrough(file, probe)) {
			onProgress(1);
			return originalVideo(file);
		}
		const buffer = await transcode(mediabunny, input, probe, onProgress, signal);
		return buffer ? compressedVideo(buffer) : originalVideo(file);
	} finally {
		input.dispose();
	}
}

/** Null when this browser cannot encode the video, so the caller falls back to the original. */
async function transcode(
	mediabunny: typeof import('mediabunny'),
	input: Input,
	probe: VideoProbe,
	onProgress: (fraction: number) => void,
	signal?: AbortSignal
): Promise<ArrayBuffer | null> {
	const size = videoTargetSize(probe.width, probe.height);
	const quality = new mediabunny.Quality({ bitrate: VIDEO_BITRATE });
	if (!(await mediabunny.canEncodeVideo('avc', { ...size, quality }))) return null;

	const target = new mediabunny.BufferTarget();
	const output = new mediabunny.Output({
		format: new mediabunny.Mp4OutputFormat({ fastStart: 'in-memory' }),
		target
	});
	let conversion: Conversion;
	try {
		conversion = await mediabunny.Conversion.init({
			input,
			output,
			tracks: 'primary',
			video: { codec: 'avc', ...size, fit: 'contain', quality, forceTranscode: true },
			// AAC is copied when it already is AAC; other audio is dropped only where AAC cannot be encoded.
			audio: { codec: 'aac', quality: new mediabunny.Quality({ bitrate: AUDIO_BITRATE }) },
			showWarnings: false
		});
	} catch {
		return null;
	}
	if (!conversion.isValid || !conversion.utilizedTracks.some((track) => track.isVideoTrack())) {
		return null;
	}

	conversion.onProgress = onProgress;
	const cancel = () => void conversion.cancel();
	signal?.addEventListener('abort', cancel, { once: true });
	try {
		signal?.throwIfAborted();
		await conversion.execute();
		return target.buffer;
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof mediabunny.ConversionCanceledError) throw error;
		return null;
	} finally {
		signal?.removeEventListener('abort', cancel);
	}
}

async function preparePhoto(file: File): Promise<PreparedMedia> {
	const result = await resizeImage(file, CLAIM_PHOTO_SPEC);
	if (!result.ok) return result;
	return { ok: true, file: result.image, type: result.image.type as PhotoType };
}

function mediaTypeOf(file: File): string {
	if (file.type) return file.type;
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	return EXTENSION_TYPES[extension] ?? '';
}

function even(value: number): number {
	return Math.max(2, Math.round(value / 2) * 2);
}
