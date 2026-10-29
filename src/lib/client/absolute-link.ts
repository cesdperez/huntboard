/** The full link to `path`, a result of `resolve()`, as seen from the page at `pageHref`. */
export function absoluteLink(path: string, pageHref: string): string {
	// resolve() returns a path relative to the current page during SSR, so anchor it to the page URL.
	return new URL(path, pageHref).href;
}
