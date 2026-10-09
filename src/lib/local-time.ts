/**
 * Converts between datetime-local field values and stored UTC ISO strings.
 * Runs in the browser, because only the browser knows the viewer's time zone.
 */

/** A datetime-local value read in the browser's time zone, as UTC ISO. Null when empty or not a date. */
export function localInputToUtc(value: string): string | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A stored UTC ISO time as a datetime-local value on the browser's wall clock. */
export function utcToLocalInput(iso: string | null): string {
	if (!iso) return '';
	const date = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}
