import { describe, expect, it } from 'vitest';
import { ORIGINAL_VIDEO_MAX_BYTES, VIDEO_MAX_BYTES } from '../domain/claim-media.js';
import {
	UNSUPPORTED_VIDEO,
	ORIGINAL_VIDEO_TOO_LARGE,
	canPassThrough,
	classifyMedia,
	isTooLong,
	originalVideo,
	videoTargetSize,
	type VideoProbe
} from './claim-media.js';

function file(name: string, type: string, size = 1000): File {
	return new File([new Uint8Array(size)], name, { type });
}

describe('classifyMedia', () => {
	it('reads the kind from the MIME type', () => {
		expect(classifyMedia(file('a.heic', 'image/heic'))).toBe('photo');
		expect(classifyMedia(file('a.mov', 'video/quicktime'))).toBe('video');
	});

	it('falls back to the extension when the picker gives no type', () => {
		expect(classifyMedia(file('IMG_1.JPG', ''))).toBe('photo');
		expect(classifyMedia(file('clip.mp4', ''))).toBe('video');
	});

	it('refuses anything else', () => {
		expect(classifyMedia(file('notes.pdf', 'application/pdf'))).toBeNull();
		expect(classifyMedia(file('mystery', ''))).toBeNull();
	});
});

describe('videoTargetSize', () => {
	it('shrinks landscape 1080p to 720p', () => {
		expect(videoTargetSize(1920, 1080)).toEqual({ width: 1280, height: 720 });
	});

	it('shrinks portrait video by its short edge, so phone clips stay sharp', () => {
		expect(videoTargetSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
	});

	it('never scales up', () => {
		expect(videoTargetSize(640, 480)).toEqual({ width: 640, height: 480 });
	});

	it('keeps both sides even, as H.264 needs', () => {
		expect(videoTargetSize(1440, 1080)).toEqual({ width: 960, height: 720 });
		expect(videoTargetSize(3840, 1634)).toEqual({ width: 1692, height: 720 });
		expect(videoTargetSize(321, 241)).toEqual({ width: 322, height: 242 });
	});
});

describe('isTooLong', () => {
	it('allows a minute, with slack for rounding in the file metadata', () => {
		expect(isTooLong(60)).toBe(false);
		expect(isTooLong(60.4)).toBe(false);
	});

	it('refuses longer videos', () => {
		expect(isTooLong(61)).toBe(true);
	});
});

describe('canPassThrough', () => {
	const ready: VideoProbe = {
		seconds: 30,
		videoCodec: 'avc',
		audioCodec: 'aac',
		width: 1280,
		height: 720
	};
	const mp4 = file('clip.mp4', 'video/mp4', 5 * 1024 * 1024);

	it('sends a small H.264 MP4 at 720p as it is', () => {
		expect(canPassThrough(mp4, ready)).toBe(true);
		expect(canPassThrough(mp4, { ...ready, audioCodec: null })).toBe(true);
	});

	it('re-encodes other codecs and containers', () => {
		expect(canPassThrough(mp4, { ...ready, videoCodec: 'hevc' })).toBe(false);
		expect(canPassThrough(mp4, { ...ready, audioCodec: 'opus' })).toBe(false);
		expect(canPassThrough(file('clip.mov', 'video/quicktime', 1000), ready)).toBe(false);
	});

	it('re-encodes video above 720p', () => {
		expect(canPassThrough(mp4, { ...ready, width: 1920, height: 1080 })).toBe(false);
	});

	it('re-encodes a file above the bitrate budget', () => {
		expect(canPassThrough(mp4, { ...ready, seconds: 10 })).toBe(false);
	});

	it('re-encodes a file above the size limit', () => {
		const big = file('clip.mp4', 'video/mp4', VIDEO_MAX_BYTES + 1);
		expect(canPassThrough(big, { ...ready, seconds: 120 })).toBe(false);
	});
});

describe('originalVideo', () => {
	it('sends a recorded video as it is when it fits', () => {
		const clip = file('clip.mov', 'video/quicktime');
		expect(originalVideo(clip)).toEqual({ ok: true, file: clip, type: 'video/quicktime' });
	});

	it('names the type from the extension when the picker gives none', () => {
		const result = originalVideo(file('clip.webm', ''));
		expect(result).toMatchObject({ ok: true, type: 'video/webm' });
		expect(result.ok && result.file.type).toBe('video/webm');
	});

	it('refuses a file above the original size limit', () => {
		const big = file('clip.mp4', 'video/mp4', ORIGINAL_VIDEO_MAX_BYTES + 1);
		expect(originalVideo(big)).toEqual({ ok: false, message: ORIGINAL_VIDEO_TOO_LARGE });
	});

	it('refuses a type the server does not store', () => {
		expect(originalVideo(file('clip.avi', 'video/x-msvideo'))).toEqual({
			ok: false,
			message: UNSUPPORTED_VIDEO
		});
	});
});
