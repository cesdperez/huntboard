const MS_PER_MINUTE = 60_000;

/** "4 min ago", "2 h 5 min ago". A time ahead of this clock reads as just now, since clocks drift. */
export function timeAgo(iso: string, now: Date): string {
	const minutes = Math.floor((now.getTime() - Date.parse(iso)) / MS_PER_MINUTE);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
}
