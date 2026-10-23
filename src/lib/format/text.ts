/** Trims and turns every run of whitespace, line breaks included, into one space. */
export function collapseSpaces(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}
