import { normalizeName } from './name.js';

/** Shared by the sign-up form and the server check. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

export const normalizeDisplayName = (value: unknown) =>
	normalizeName(value, DISPLAY_NAME_MAX_LENGTH);

/** Where to go after signing in: a path on this site, or My games for anything else. */
export function nextPath(value: string | null | undefined): string {
	// "//host" and "/\host" leave the site, and browsers drop tabs and newlines to make them.
	if (!value || !value.startsWith('/') || value.startsWith('//') || /[\s\\]/.test(value)) {
		return '/games';
	}
	return value;
}

/** The sign-in page, returning to `path` afterwards. */
export function signInPath(path: string): string {
	return `/login?next=${encodeURIComponent(path)}`;
}

/** The longest address SMTP delivers. */
export const EMAIL_MAX_LENGTH = 254;

/** A trimmed, lowercase address that looks deliverable, or null. Sending the email is the real check. */
export function normalizeEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim().toLowerCase();
	if (email.length > EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
	return email;
}
