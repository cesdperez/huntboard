import { normalizeName } from './name.js';

/** Shared by the sign-up form and the server check. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

export const normalizeDisplayName = (value: unknown) =>
	normalizeName(value, DISPLAY_NAME_MAX_LENGTH);

/** Where to go after signing in: a path on this site, or My games for anything else. */
export function nextPath(value: string | null | undefined): string {
	// "//host" and "/\host" leave the site, and browsers drop tabs and newlines to make them.
	// Only visible ASCII is safe in a Location header: other characters fail the response.
	if (
		!value ||
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		!/^[\x21-\x7e]+$/.test(value)
	) {
		return '/games';
	}
	// The sign-in page sends a signed-in user to next, so next on it would redirect forever.
	if (/^\/login(?:[/?#]|$)/.test(value)) return '/games';
	return value;
}

/** The sign-in page, returning to `path` afterwards. */
export function signInPath(path: string): string {
	return `/login?next=${encodeURIComponent(path)}`;
}

/** The longest address SMTP delivers. */
export const EMAIL_MAX_LENGTH = 254;

// A bare addr-spec with dot-atom parts. Quotes, angle brackets and commas would let the provider
// read a display name or a second recipient into the address.
const PLAIN_ADDRESS = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u;

/** A trimmed, lowercase plain address that looks deliverable, or null. Sending the email is the real check. */
export function normalizeEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim().toLowerCase();
	if (email.length > EMAIL_MAX_LENGTH || !PLAIN_ADDRESS.test(email)) return null;
	return email;
}
