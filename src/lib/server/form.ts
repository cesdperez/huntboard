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
