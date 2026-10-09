/** A text field, trimmed. Missing fields and file uploads read as ''. */
export function readString(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value.trim() : '';
}
