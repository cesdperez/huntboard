import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { THEMES, themeImages, type Theme } from '#lib/themes/index.js';
import { QUIET_ZONE, qrSvg } from './qr-code.js';

const STATIC_DIR = path.join(import.meta.dirname, '../../../static');

const LINKS = [
	'https://huntboard.example.com/t/3f9c2a7e0b1d4c6a8e5f7a9b0c1d2e3f',
	'https://huntboard.example.com/s/a1b2c3d4e5f60718293a4b5c6d7e8f90',
	'http://localhost:5173/a/00000000000000000000000000000000'
];

// The browser fetches the icon by path. resvg reads no files, so the test inlines the same one.
function svgFor(text: string, theme: Theme): string {
	const icon = readFileSync(path.join(STATIC_DIR, themeImages(theme).icon));
	return qrSvg(text, {
		...theme.qr,
		logo: `data:image/svg+xml;base64,${icon.toString('base64')}`
	});
}

function render(svg: string, width: number) {
	const image = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
	return { width: image.width, height: image.height, pixels: new Uint8ClampedArray(image.pixels) };
}

function sizeOf(svg: string): number {
	return Number(svg.match(/viewBox="0 0 (\d+) \1"/)![1]);
}

describe('qrSvg', () => {
	// Phones scan the printed cards small and the big screen from far away.
	describe.each(THEMES)('in the $id theme', (theme) => {
		it.each(LINKS.flatMap((link) => [180, 600].map((width) => [link, width] as const)))(
			'scans back to %s at %ipx',
			(link, width) => {
				const { pixels, height } = render(svgFor(link, theme), width);

				expect(jsQR(pixels, width, height)?.data).toBe(link);
			}
		);
	});

	it('keeps a light quiet zone around the code, so a scanner finds its edges on any background', () => {
		const svg = svgFor(LINKS[0], THEMES[0]);
		const moduleSize = 10;
		const { width, pixels } = render(svg, sizeOf(svg) * moduleSize);
		const edge = QUIET_ZONE * moduleSize;

		for (let y = 0; y < width; y++) {
			for (let x = 0; x < width; x++) {
				if (x >= edge && x < width - edge && y >= edge && y < width - edge) continue;
				const i = (y * width + x) * 4;
				expect([pixels[i], pixels[i + 1], pixels[i + 2]]).toEqual([255, 255, 255]);
			}
		}
	});

	it('draws the code in dark theme colours on white', () => {
		for (const theme of THEMES) {
			const fills = [...svgFor(LINKS[0], theme).matchAll(/fill="([^"]+)"/g)].map(
				([, fill]) => fill
			);

			expect(new Set(fills)).toEqual(new Set(['#ffffff', theme.qr.ink, theme.qr.eye]));
		}
	});
});
