// Crockford base32: no I, L, O or U, so a code read out loud or off paper has one spelling.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const JOIN_CODE_LENGTH = 8;
const CODE_BITS = JOIN_CODE_LENGTH * 5;
// Whole base64url characters inside the code's 40 bits: 6, or 36 bits.
const PREFIX_LENGTH = Math.floor(CODE_BITS / 6);
const SEPARATORS = /[\s\-‐-―]/g;

/**
 * A team's join code: the first 40 bits of its link token in Crockford base32. Rotating the link
 * changes the code with it, and the code opens nothing the link does not.
 */
export function joinCodeOf(token: string): string {
	// 7 base64url characters hold 42 bits, still exact in a double.
	let bits = 0;
	for (const char of token.slice(0, PREFIX_LENGTH + 1)) bits = bits * 64 + BASE64URL.indexOf(char);
	let value = Math.floor(bits / 4);
	let code = '';
	for (let index = 0; index < JOIN_CODE_LENGTH; index++) {
		code = CROCKFORD[value % 32] + code;
		value = Math.floor(value / 32);
	}
	return code;
}

/** The base64url characters every token with this code starts with, for a lookup on the token index. */
export function tokenPrefixOf(code: string): string {
	let value = 0;
	for (const char of code) value = value * 32 + CROCKFORD.indexOf(char);
	let rest = Math.floor(value / 2 ** (CODE_BITS - PREFIX_LENGTH * 6));
	let prefix = '';
	for (let index = 0; index < PREFIX_LENGTH; index++) {
		prefix = BASE64URL[rest % 64] + prefix;
		rest = Math.floor(rest / 64);
	}
	return prefix;
}

/** How a code is shown and read out: two groups of four. */
export function formatJoinCode(code: string): string {
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The code a player typed, forgiving case, separators and look-alike letters, or null if it cannot be one. */
export function normalizeJoinCode(input: string): string | null {
	const code = input
		.replace(SEPARATORS, '')
		.toUpperCase()
		.replaceAll('O', '0')
		.replace(/[IL]/g, '1');
	if (code.length !== JOIN_CODE_LENGTH) return null;
	return [...code].every((char) => CROCKFORD.includes(char)) ? code : null;
}
