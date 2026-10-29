import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_THEME,
	FLAG_THEME,
	THEMES,
	htmlAttributes,
	isThemeId,
	resolveAppearance,
	resolveTheme,
	supportedModes,
	themeImages,
	type Theme
} from './index.js';

const STATIC_DIR = path.join(import.meta.dirname, '../../../static');

const night: Theme = {
	id: 'night',
	name: 'Night',
	modes: { dark: { themeColor: '#101b2b' } },
	fonts: [],
	layout: 'plain'
};
const registry = [FLAG_THEME, night];

describe('resolveTheme', () => {
	it('finds a registered theme by id', () => {
		expect(resolveTheme('night', registry)).toBe(night);
	});

	it('falls back to the default theme for an unknown or missing id', () => {
		expect(resolveTheme('tartan')).toBe(DEFAULT_THEME);
		expect(resolveTheme('tartan', registry)).toBe(DEFAULT_THEME);
		expect(resolveTheme(null, registry)).toBe(DEFAULT_THEME);
		expect(resolveTheme(undefined, registry)).toBe(DEFAULT_THEME);
	});

	it('knows the flag, Highland Bru and Azulejo themes by default', () => {
		expect(THEMES.map((theme) => theme.id)).toEqual(['flag', 'highland-bru', 'azulejo']);
		expect(resolveTheme('flag')).toBe(FLAG_THEME);
	});

	// Pages without a game wear the theme new games start in, so the app reads as one product.
	it('defaults to Highland Bru while flag stays selectable', () => {
		expect(DEFAULT_THEME.id).toBe('highland-bru');
		expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
		expect(resolveTheme('flag').id).toBe('flag');
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
		expect(supportedModes(FLAG_THEME)).toEqual(['light', 'dark']);
		expect(supportedModes(night)).toEqual(['dark']);
	});
});

describe('resolveAppearance', () => {
	it('follows the OS for a theme with both modes', () => {
		expect(resolveAppearance('flag', undefined, registry)).toEqual({
			theme: FLAG_THEME,
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
		expect(htmlAttributes({ theme: FLAG_THEME, mode: null })).toBe('data-game-theme="flag"');
		expect(htmlAttributes({ theme: night, mode: 'dark' })).toBe(
			'data-game-theme="night" data-theme="dark"'
		);
	});
});

describe('registered themes', () => {
	// The browser chrome continues the top of the page: the paper, or the event layout's app bar.
	it.each(THEMES)('$id colours the browser chrome like the top of its page', (theme) => {
		const css = readFileSync(path.join(import.meta.dirname, `${theme.id}.css`), 'utf8');
		const token = theme.layout === 'event' ? '--app-bar-base' : '--paper';
		const colours = [...css.matchAll(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'gi'))].map(
			(match) => match[1].toLowerCase()
		);

		expect(colours).toEqual(supportedModes(theme).map((mode) => theme.modes[mode]?.themeColor));
	});

	it.each(THEMES)('$id ships its icons, link preview image and wordmark', (theme) => {
		const files = [...Object.values(themeImages(theme)), theme.wordmark?.src].filter(Boolean);

		for (const file of files) {
			expect(existsSync(path.join(STATIC_DIR, file!)), file).toBe(true);
		}
	});
});

describe('Highland Bru theme', () => {
	it('is a light-only event theme', () => {
		const theme = resolveTheme('highland-bru');

		expect(supportedModes(theme)).toEqual(['light']);
		expect(theme.layout).toBe('event');
		expect(FLAG_THEME.layout).toBe('plain');
	});
});

describe('Azulejo theme', () => {
	it('is a light-only event theme that shows the Lightmile wordmark in the app bar', () => {
		const theme = resolveTheme('azulejo');

		expect(supportedModes(theme)).toEqual(['light']);
		expect(theme.layout).toBe('event');
		expect(theme.wordmark).toEqual({ src: '/themes/azulejo/wordmark.svg', alt: 'Lightmile' });
	});

	it('leaves the other themes on the Huntboard name', () => {
		expect(FLAG_THEME.wordmark).toBeUndefined();
		expect(resolveTheme('highland-bru').wordmark).toBeUndefined();
	});
});
