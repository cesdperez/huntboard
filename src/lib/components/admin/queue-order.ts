interface Queued {
	id: number;
	marked_at: string;
}

/** Oldest claim first, so the queue is judged in the order teams claimed. */
export function byQueueOrder(a: Queued, b: Queued): number {
	return a.marked_at.localeCompare(b.marked_at) || a.id - b.id;
}

/** The claim shown where a judged one was: the one after it, or the last one when it was last. */
export function takesPlaceOf<T extends Queued>(remaining: T[], gone: Queued): T | null {
	return remaining.find((claim) => byQueueOrder(claim, gone) > 0) ?? remaining.at(-1) ?? null;
}
