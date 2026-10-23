/**
 * Compares in constant time, so response timing does not leak how much of a guess was right.
 * An unset or empty secret matches nothing, so a missing config cannot open game creation.
 */
export async function creationCodeMatches(
	given: string,
	expected: string | undefined
): Promise<boolean> {
	if (!expected) return false;
	// Hashing first makes both sides the same length, so the length does not leak either.
	const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
	let difference = 0;
	for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
	return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
