/** A text field, trimmed. Missing fields and file uploads read as ''. */
export function readString(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

/** A row id field: a positive whole number, or null for anything else. */
export function readId(data: FormData, key: string): number | null {
	const id = Number(readString(data, key));
	return Number.isInteger(id) && id > 0 ? id : null;
}

/** null for an empty field, undefined for one that is not in toISOString() format. */
export function readUtcTime(data: FormData, key: string): string | null | undefined {
	const value = readString(data, key);
	if (!value) return null;
	const date = new Date(value);
	// Stored times are compared as strings, in SQL and in code, which only holds for this exact format.
	return !Number.isNaN(date.getTime()) && date.toISOString() === value ? value : undefined;
}
