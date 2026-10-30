/** Trims and turns every run of whitespace, line breaks included, into one space. */
export function collapseSpaces(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

/** The text before its last word, and that word. Null for a single word. */
export function splitLastWord(text: string): { head: string; tail: string } | null {
	const match = /^(.*\S)\s+(\S+)$/s.exec(text.trim());
	return match && { head: match[1], tail: match[2] };
}

// Right-to-left letters and the bidi controls, the only text that can reorder what is around it.
const BIDI_SENSITIVE =
	/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u061c\u200f\u202a-\u202e\u2066-\u2069]|[\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;

/**
 * Wraps user text in a first-strong isolate, so a right-to-left override or name in it cannot
 * reorder the app text beside it. For strings; markup uses <bdi>. Other text stays as it is.
 */
export function isolate(text: string): string {
	return BIDI_SENSITIVE.test(text) ? `\u2068${text}\u2069` : text;
}
