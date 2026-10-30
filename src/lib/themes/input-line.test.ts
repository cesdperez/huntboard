import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 1.4.11: the border is what shows where an input is, so it needs 3:1 against what is
// inside it and what is around it.
const NON_TEXT_CONTRAST = 3;

function css(theme: string): string {
	return readFileSync(path.join(import.meta.dirname, `${theme}.css`), 'utf8');
}

function token(block: string, name: string): string {
	const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'));
	if (!match) throw new Error(`--${name} is not a hex colour here`);
	return match[1];
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
const palettes = {
	'flag light': flag.slice(0, flag.indexOf('@variant dark')),
	'flag dark': flag.slice(flag.indexOf('@variant dark')),
	'highland-bru': css('highland-bru'),
	azulejo: css('azulejo')
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
