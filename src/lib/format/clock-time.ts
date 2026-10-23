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

/** A UTC ISO time as the viewer's calendar day, "24 October", with the year only when it differs. */
export function formatDay(
	iso: string,
	now: Date,
	{ locale, timeZone }: ClockTimeOptions = {}
): string {
	const date = new Date(iso);
	const year = new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric' });
	const sameYear = year.format(date) === year.format(now);
	return new Intl.DateTimeFormat(locale, {
		timeZone,
		day: 'numeric',
		month: 'long',
		year: sameYear ? undefined : 'numeric'
	}).format(date);
}
