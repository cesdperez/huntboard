/** A static file: fetching it never runs the Worker, so checking costs nothing from the request budget. */
export const REACHABLE_URL = '/reachable.txt';

export async function isReachable(fetcher: typeof fetch = fetch): Promise<boolean> {
	try {
		const response = await fetcher(REACHABLE_URL, { cache: 'no-store' });
		return response.ok;
	} catch {
		return false;
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
