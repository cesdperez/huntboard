import { collapseSpaces } from '../format/text.js';

// A joiner between pictographs and the tags after a black flag build one emoji, so they stay.
const INVISIBLE =
	/(\p{Extended_Pictographic}[\p{M}\p{Emoji_Modifier}]*‍)(?=\p{Extended_Pictographic})|(\u{1f3f4}[\u{e0020}-\u{e007e}]+\u{e007f})|\p{Cf}/gu;

/** Drops invisible format characters, such as zero-width spaces and bidi controls, and composes accents. */
export function visibleText(text: string): string {
	return text
		.replace(INVISIBLE, (_, joined?: string, flag?: string) => joined ?? flag ?? '')
		.normalize('NFC');
}

/**
 * Trimmed name with inner whitespace collapsed, accents composed and invisible characters dropped,
 * or null when it is empty or too long.
 */
export function normalizeName(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = collapseSpaces(visibleText(value));
	if (!trimmed || trimmed.length > maxLength) return null;
	return trimmed;
}
