import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_THEME,
	THEMES,
	htmlAttributes,
	isThemeId,
	resolveAppearance,
	resolveTheme,
	supportedModes,
	type Theme
} from './index.js';

const night: Theme = {
	id: 'night',
	name: 'Night',
	modes: { dark: { themeColor: '#101b2b' } },
	fonts: [],
	layout: 'plain'
};
const registry = [DEFAULT_THEME, night];

describe('resolveTheme', () => {
	it('finds a registered theme by id', () => {
		expect(resolveTheme('night', registry)).toBe(night);
	});

	it('falls back to the default theme for an unknown or missing id', () => {
		expect(resolveTheme('tartan', registry)).toBe(DEFAULT_THEME);
		expect(resolveTheme(null, registry)).toBe(DEFAULT_THEME);
		expect(resolveTheme(undefined, registry)).toBe(DEFAULT_THEME);
	});

	it('knows the flag and Highland Bru themes by default', () => {
		expect(THEMES.map((theme) => theme.id)).toEqual(['flag', 'highland-bru']);
		expect(resolveTheme('flag')).toBe(DEFAULT_THEME);
	});
});

describe('isThemeId', () => {
	it('accepts registered ids only', () => {
		expect(isThemeId('night', registry)).toBe(true);
		expect(isThemeId('tartan', registry)).toBe(false);
		expect(isThemeId('', registry)).toBe(false);
		expect(isThemeId('toString', registry)).toBe(false);
	});
});

describe('supportedModes', () => {
	it('lists the modes a theme declares', () => {
		expect(supportedModes(DEFAULT_THEME)).toEqual(['light', 'dark']);
		expect(supportedModes(night)).toEqual(['dark']);
	});
});

describe('resolveAppearance', () => {
	it('follows the OS for a theme with both modes', () => {
		expect(resolveAppearance('flag', undefined, registry)).toEqual({
			theme: DEFAULT_THEME,
			mode: null
		});
	});

	it('forces the one mode of a single-mode theme', () => {
		expect(resolveAppearance('night', undefined, registry)).toEqual({ theme: night, mode: 'dark' });
		expect(resolveAppearance('night', 'light', registry)).toEqual({ theme: night, mode: 'dark' });
	});

	it('keeps a requested mode the theme supports', () => {
		expect(resolveAppearance('flag', 'dark', registry).mode).toBe('dark');
		expect(resolveAppearance('flag', 'light', registry).mode).toBe('light');
	});

	it('falls back to the default theme for an unknown id', () => {
		expect(resolveAppearance('tartan', undefined, registry).theme).toBe(DEFAULT_THEME);
	});
});

describe('htmlAttributes', () => {
	it('names the theme, and the mode only when one is set', () => {
		expect(htmlAttributes({ theme: DEFAULT_THEME, mode: null })).toBe('data-game-theme="flag"');
		expect(htmlAttributes({ theme: night, mode: 'dark' })).toBe(
			'data-game-theme="night" data-theme="dark"'
		);
	});
});

describe('registered themes', () => {
	it.each(THEMES)('$id colours the browser chrome with its --paper in each mode', (theme) => {
		const css = readFileSync(path.join(import.meta.dirname, `${theme.id}.css`), 'utf8');
		const papers = [...css.matchAll(/--paper:\s*(#[0-9a-f]{6})/gi)].map((match) =>
			match[1].toLowerCase()
		);

		expect(papers).toEqual(supportedModes(theme).map((mode) => theme.modes[mode]?.themeColor));
	});
});

describe('Highland Bru theme', () => {
	it('is a light-only event theme', () => {
		const theme = resolveTheme('highland-bru');

		expect(supportedModes(theme)).toEqual(['light']);
		expect(theme.layout).toBe('event');
		expect(DEFAULT_THEME.layout).toBe('plain');
	});
});
