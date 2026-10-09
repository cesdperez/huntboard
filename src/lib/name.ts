/** Trimmed name with inner whitespace collapsed, or null when it is empty or too long. */
export function normalizeName(value: unknown, maxLength: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed || trimmed.length > maxLength) return null;
	return trimmed;
}
