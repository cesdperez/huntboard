import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import { resolveTheme, type ColorMode } from '#lib/themes/index.js';
import type { PageServerLoad } from './$types';

/** Previews ?theme=<id> in ?mode=light or dark, rendered on the server like a game page. */
export const load: PageServerLoad = ({ url, locals }) => {
	if (!dev) error(404, 'Not found');
	const gameTheme = resolveTheme(url.searchParams.get('theme')).id;
	const mode = url.searchParams.get('mode');
	const colorMode: ColorMode | undefined = mode === 'light' || mode === 'dark' ? mode : undefined;
	locals.gameTheme = gameTheme;
	locals.colorMode = colorMode;
	return { gameTheme, colorMode };
};
