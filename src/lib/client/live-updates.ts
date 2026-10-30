/** Sets the D1 rows read budget, see the README "Free-tier budget". */
export const POLL_INTERVAL_MS = 60_000;

export interface PollingOptions {
	intervalMs?: number;
	document?: Pick<Document, 'visibilityState'> & EventTarget;
	window?: EventTarget;
}

/**
 * Calls refresh every interval while the page is visible, and at once when it shows again, gets
 * focus or comes back online. Never runs two refreshes at a time: such an event during a refresh
 * runs one more after it. Returns a function that stops it.
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
	let followUp = false;

	async function poll() {
		if (running) return;
		running = true;
		do {
			followUp = false;
			try {
				await refresh();
			} catch {
				// Offline or a failed load: the next tick tries again.
			}
		} while (followUp);
		running = false;
	}

	function schedule() {
		clearInterval(timer);
		timer = doc.visibilityState === 'visible' ? setInterval(poll, intervalMs) : undefined;
	}

	function refreshNow() {
		schedule();
		if (doc.visibilityState !== 'visible') return;
		// The running refresh may have read the server before the change this event signals.
		if (running) followUp = true;
		else void poll();
	}

	doc.addEventListener('visibilitychange', refreshNow);
	win.addEventListener('focus', refreshNow);
	win.addEventListener('online', refreshNow);
	schedule();

	return () => {
		clearInterval(timer);
		followUp = false;
		doc.removeEventListener('visibilitychange', refreshNow);
		win.removeEventListener('focus', refreshNow);
		win.removeEventListener('online', refreshNow);
	};
}
