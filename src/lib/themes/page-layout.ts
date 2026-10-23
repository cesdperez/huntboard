import { page } from '$app/state';
import { resolveTheme, type ThemeLayout } from './index.js';

/** The layout of the theme the current page wears. Read it in a $derived to follow navigation. */
export function pageLayout(): ThemeLayout {
	return resolveTheme(page.data.gameTheme).layout;
}
