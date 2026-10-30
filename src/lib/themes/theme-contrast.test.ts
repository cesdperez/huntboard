import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 1.4.11: the border is what shows where an input is, so it needs 3:1 against what is
// inside it and what is around it.
const NON_TEXT_CONTRAST = 3;
// WCAG 1.4.3 for the 17px semibold button label.
const TEXT_CONTRAST = 4.5;

function css(theme: string): string {
	return readFileSync(path.join(import.meta.dirname, `${theme}.css`), 'utf8');
}

function token(block: string, name: string): string {
	const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'));
	if (!match) throw new Error(`--${name} is not a hex colour here`);
	return match[1];
}

/** A token's colour, following var() and falling back to the base layer as the cascade does. */
function resolve(block: string, name: string): string {
	for (const source of [block, palettes['flag light']]) {
		const match = source.match(
			new RegExp(`--${name}:\\s*(#[0-9a-f]{6}|var\\(--([\\w-]+)\\));`, 'i')
		);
		if (match) return match[2] ? resolve(block, match[2]) : match[1];
	}
	throw new Error(`--${name} is not a colour here`);
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

const flag = css('flag');
const contour = css('contour');
const palettes = {
	'flag light': flag.slice(0, flag.indexOf('@variant dark')),
	'flag dark': flag.slice(flag.indexOf('@variant dark')),
	'highland-bru': css('highland-bru'),
	azulejo: css('azulejo'),
	'contour light': contour.slice(0, contour.indexOf('@variant dark')),
	'contour dark': contour.slice(contour.indexOf('@variant dark'))
};

describe('--input-line', () => {
	it.each(Object.entries(palettes))(
		'reaches 3:1 against --surface and --paper in %s',
		(_, block) => {
			const border = token(block, 'input-line');
			expect(contrast(border, token(block, 'surface'))).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
			expect(contrast(border, token(block, 'paper'))).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
		}
	);
});

describe('--radio', () => {
	// WebKit fills a checked radio with the accent colour and draws no ring around it.
	it.each(Object.entries(palettes))(
		'reaches 3:1 against --surface and --paper in %s',
		(_, block) => {
			const radio = resolve(block, 'radio');
			expect(contrast(radio, resolve(block, 'surface'))).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
			expect(contrast(radio, resolve(block, 'paper'))).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
		}
	);
});

describe('--action-hover', () => {
	it.each(Object.entries(palettes))('keeps the button label at 4.5:1 in %s', (_, block) => {
		expect(contrast(token(block, 'action-hover'), token(block, 'on-flag'))).toBeGreaterThanOrEqual(
			TEXT_CONTRAST
		);
	});
});
