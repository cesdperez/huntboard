const TOKEN_BYTES = 16;

/** Unguessable link token: 128 random bits as 22 base64url characters. Uses Web Crypto, so it runs in Workers. */
export function generateToken(): string {
	return encodeBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** Base64url without padding, safe in URL paths. */
export function encodeBase64Url(bytes: Uint8Array): string {
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
