import { normalizeNickname } from '#lib/nickname.js';

/** A text field, trimmed. Missing fields and file uploads read as ''. */
export function readString(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

/** The nickname NicknameField sends with every form, or null when the viewer has none yet. */
export function readNickname(data: FormData): string | null {
	return normalizeNickname(data.get('nickname'));
}
