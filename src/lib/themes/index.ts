export type ColorMode = 'light' | 'dark';

/**
 * `plain` is the flag layout. `event` adds an app bar and an event banner, descriptive challenge
 * rows with a points column, and a leaderboard heading.
 */
export type ThemeLayout = 'plain' | 'event';

/** A look for a game's pages. Its tokens live in <id>.css, imported by app.css. */
export interface Theme {
	id: string;
	name: string;
	/** The colour modes the theme supports. One mode is forced; both follow the OS. */
	modes: Partial<Record<ColorMode, { themeColor: string }>>;
	/** Stylesheets for every family the theme's tokens name, Archivo too if it keeps the flag sans. */
	fonts: readonly string[];
	layout: ThemeLayout;
}

/** The theme a page gets, and the mode it forces. A null mode follows the OS. */
export interface Appearance {
	theme: Theme;
	mode: ColorMode | null;
}

export const FLAG_THEME: Theme = {
	id: 'flag',
	name: 'Control flag',
	modes: { light: { themeColor: '#f5f7fa' }, dark: { themeColor: '#0f1a30' } },
	fonts: [
		'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap'
	],
	layout: 'plain'
};

const HIGHLAND_BRU: Theme = {
	id: 'highland-bru',
	name: 'Highland Bru',
	modes: { light: { themeColor: '#10241b' } },
	fonts: [
		'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600..900&family=Jersey+10&display=swap'
	],
	layout: 'event'
};

export const THEMES: readonly Theme[] = [FLAG_THEME, HIGHLAND_BRU];

/** The theme /new gives a game, and the one pages without a game wear. */
export const DEFAULT_THEME: Theme = HIGHLAND_BRU;

/** Ids stored before a theme was removed still open their game, in the default theme. */
export function resolveTheme(id: string | null | undefined, themes = THEMES): Theme {
	return themes.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export function isThemeId(id: string, themes = THEMES): boolean {
	return themes.some((theme) => theme.id === id);
}

export function supportedModes(theme: Theme): ColorMode[] {
	return (['light', 'dark'] as const).filter((mode) => theme.modes[mode]);
}

/** A requested mode previews one side of a two-mode theme. A single-mode theme ignores it. */
export function resolveAppearance(
	themeId: string | null | undefined,
	requestedMode: ColorMode | null | undefined,
	themes = THEMES
): Appearance {
	const theme = resolveTheme(themeId, themes);
	const modes = supportedModes(theme);
	if (modes.length === 1) return { theme, mode: modes[0] };
	return { theme, mode: requestedMode && modes.includes(requestedMode) ? requestedMode : null };
}

/** The <html> attributes app.css reads: data-game-theme picks the tokens, data-theme the mode. */
export function htmlAttributes({ theme, mode }: Appearance): string {
	const attributes = `data-game-theme="${theme.id}"`;
	return mode ? `${attributes} data-theme="${mode}"` : attributes;
}
