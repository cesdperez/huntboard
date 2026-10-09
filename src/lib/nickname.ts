/** Shared by the browser prompt and the server check, so both agree on what a nickname is. */
export const NICKNAME_MAX_LENGTH = 40;

/** Trimmed nickname, or null when it is empty or too long. */
export function normalizeNickname(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed || trimmed.length > NICKNAME_MAX_LENGTH) return null;
	return trimmed;
}
