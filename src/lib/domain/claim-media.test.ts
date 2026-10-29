import { describe, expect, it } from 'vitest';
import { claimMedia, mediaKeyType } from './claim-media.js';

const NAME = 'abcdefghijklmnopqrstuv';

describe('mediaKeyType', () => {
	it.each([
		['jpg', 'image/jpeg'],
		['webp', 'image/webp'],
		['mp4', 'video/mp4'],
		['mov', 'video/quicktime'],
		['webm', 'video/webm']
	])('reads %s as %s', (extension, type) => {
		expect(mediaKeyType(`7/claims/${NAME}.${extension}`)).toBe(type);
	});

	it.each([
		`7/${NAME}.jpg`,
		`7/claims/${NAME}.png`,
		`7/claims/short.jpg`,
		`07/claims/${NAME}.jpg`,
		`x/claims/${NAME}.jpg`,
		`7/claims/../${NAME}.jpg`,
		`7/claims/${NAME}.jpg/more`,
		`7/claims/${NAME}.constructor`
	])('refuses %s', (key) => {
		expect(mediaKeyType(key)).toBeNull();
	});
});

describe('claimMedia', () => {
	it('serves a photo or video from the media route, with its kind', () => {
		expect(claimMedia(`7/claims/${NAME}.webp`)).toEqual({
			src: `/media/7/claims/${NAME}.webp`,
			kind: 'photo'
		});
		expect(claimMedia(`7/claims/${NAME}.mov`)).toEqual({
			src: `/media/7/claims/${NAME}.mov`,
			kind: 'video'
		});
	});

	it('is null without media', () => {
		expect(claimMedia(null)).toBeNull();
	});
});
