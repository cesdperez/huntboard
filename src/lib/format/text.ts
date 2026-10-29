/** Trims and turns every run of whitespace, line breaks included, into one space. */
export function collapseSpaces(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

/** The text before its last word, and that word. Null for a single word. */
export function splitLastWord(text: string): { head: string; tail: string } | null {
	const match = /^(.*\S)\s+(\S+)$/s.exec(text.trim());
	return match && { head: match[1], tail: match[2] };
}
