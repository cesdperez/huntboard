/** Tests pin these. In the browser both default to the viewer's own settings. */
export interface ClockTimeOptions {
	locale?: string;
	timeZone?: string;
}

/**
 * A UTC ISO time on the viewer's wall clock: "21:00" on the same day as now, else with the day.
 * Runs in the browser, because the server only knows UTC.
 */
export function formatClockTime(
	iso: string,
	now: Date,
	{ locale, timeZone }: ClockTimeOptions = {}
): string {
	const date = new Date(iso);
	const day = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'short' });
	const time = new Intl.DateTimeFormat(locale, { timeZone, timeStyle: 'short' }).format(date);
	if (day.format(date) === day.format(now)) return time;
	const weekday = new Intl.DateTimeFormat(locale, {
		timeZone,
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	}).format(date);
	return `${weekday}, ${time}`;
}
