/** A static file: fetching it never runs the Worker, so checking costs nothing from the request budget. */
export const REACHABLE_URL = '/reachable.txt';

// A stalled request would hold up every later poll, as polling never runs two checks at once.
export const REACHABLE_TIMEOUT_MS = 10_000;

export async function isReachable(fetcher: typeof fetch = fetch): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REACHABLE_TIMEOUT_MS);
	try {
		const response = await fetcher(REACHABLE_URL, {
			cache: 'no-store',
			signal: controller.signal
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Refreshes only when the server answers. A refresh that fails on the way swaps the page for the
 * error page, so offline the page keeps what it last showed instead.
 */
export async function refreshIfReachable(
	refresh: () => Promise<unknown>,
	report: (online: boolean) => void,
	reachable: () => Promise<boolean> = isReachable
): Promise<void> {
	const online = await reachable();
	report(online);
	if (online) await refresh();
}
