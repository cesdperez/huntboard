/** Load functions that show live game state call depends(GAME_DATA), so invalidating it refreshes them. */
export const GAME_DATA = 'huntboard:game';

/** Sets the Worker request budget, see docs/decisions.md "Live updates by polling". */
export const POLL_INTERVAL_MS = 15_000;

export interface PollingOptions {
	intervalMs?: number;
	document?: Pick<Document, 'visibilityState'> & EventTarget;
	window?: EventTarget;
}

/**
 * Calls refresh every interval while the page is visible, and at once when it shows again, gets
 * focus or comes back online. Never runs two refreshes at a time. Returns a function that stops it.
 */
export function startPolling(
	refresh: () => Promise<unknown>,
	{
		intervalMs = POLL_INTERVAL_MS,
		document: doc = document,
		window: win = window
	}: PollingOptions = {}
): () => void {
	let timer: ReturnType<typeof setInterval> | undefined;
	let running = false;

	async function poll() {
		if (running) return;
		running = true;
		try {
			await refresh();
		} catch {
			// Offline or a failed load: the next tick tries again.
		} finally {
			running = false;
		}
	}

	function schedule() {
		clearInterval(timer);
		timer = doc.visibilityState === 'visible' ? setInterval(poll, intervalMs) : undefined;
	}

	function refreshNow() {
		schedule();
		if (doc.visibilityState === 'visible') void poll();
	}

	doc.addEventListener('visibilitychange', refreshNow);
	win.addEventListener('focus', refreshNow);
	win.addEventListener('online', refreshNow);
	schedule();

	return () => {
		clearInterval(timer);
		doc.removeEventListener('visibilitychange', refreshNow);
		win.removeEventListener('focus', refreshNow);
		win.removeEventListener('online', refreshNow);
	};
}
