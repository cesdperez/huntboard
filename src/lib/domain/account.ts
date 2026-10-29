import { normalizeName } from './name.js';

/** Shared by the sign-up form and the server check. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

export const normalizeDisplayName = (value: unknown) =>
	normalizeName(value, DISPLAY_NAME_MAX_LENGTH);

/** Where to go after signing in: a path on this site, or My games for anything else. */
export function nextPath(value: string | null | undefined): string {
	// "//host" and "/\host" are protocol-relative URLs that leave the site.
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return '/games';
	}
	return value;
}
