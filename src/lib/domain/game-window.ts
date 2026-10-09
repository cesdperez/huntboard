/** Where a moment falls relative to the game's start and end. Teams may only mark claims 'during'. */
export type GamePhase = 'before' | 'during' | 'after';

/** Start and end as stored: UTC ISO strings, or null while not set. */
export type GameWindow = { startsAt: string | null; endsAt: string | null };

/**
 * Start is inclusive and end is exclusive. A game missing either time counts as 'before',
 * because it is not scheduled yet. Throws RangeError on a time that is not a valid date.
 */
export function gamePhase(window: GameWindow, now: Date): GamePhase {
	const start = parseTime(window.startsAt);
	const end = parseTime(window.endsAt);
	if (start === null || end === null) return 'before';

	const at = now.getTime();
	if (at < start) return 'before';
	if (at < end) return 'during';
	return 'after';
}

function parseTime(value: string | null): number | null {
	if (!value) return null;
	const time = Date.parse(value);
	if (Number.isNaN(time)) {
		throw new RangeError(`Invalid game time: ${value}`);
	}
	return time;
}
