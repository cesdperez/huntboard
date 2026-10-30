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

export interface PageWindow {
	fetch: typeof fetch;
	location: Pick<Location, 'pathname'>;
}

// Like REACHABLE_TIMEOUT_MS: a stalled data request would otherwise skip every later poll.
export const DATA_TIMEOUT_MS = 10_000;

/**
 * Runs a background refresh of this page's data and resolves whether it updated. SvelteKit swaps
 * the page for the error page when its data request fails, which would lose open sheets and typed
 * notes over a passing server error or rate limit. So a failed data request for this page never
 * answers, the refresh is dropped, and the next poll tries again. A dead link still gets through.
 * A refresh that takes longer than DATA_TIMEOUT_MS also counts as not updated.
 */
export async function refreshKeepingPage(
	refresh: () => Promise<unknown>,
	page: PageWindow = window
): Promise<boolean> {
	let failed!: () => void;
	const failure = new Promise<boolean>((resolve) => (failed = () => resolve(false)));
	const timer = setTimeout(failed, DATA_TIMEOUT_MS);
	const release = guardDataRequests(page, failed);
	try {
		return await Promise.race([refresh().then(() => true), failure]);
	} finally {
		clearTimeout(timer);
		release();
	}
}

interface DataGuard {
	original: typeof fetch;
	wrapper: typeof fetch;
	refreshes: Set<() => void>;
}

const guards = new WeakMap<PageWindow, DataGuard>();

// One wrapper per page, shared by overlapping refreshes, so fetch goes back only when the last one
// ends, in whatever order they end.
function guardDataRequests(page: PageWindow, failed: () => void): () => void {
	const guard = guards.get(page) ?? installGuard(page);
	guard.refreshes.add(failed);
	return () => {
		guard.refreshes.delete(failed);
		if (guard.refreshes.size > 0 || page.fetch !== guard.wrapper) return;
		page.fetch = guard.original;
		guards.delete(page);
	};
}

function installGuard(page: PageWindow): DataGuard {
	const original = page.fetch;
	const refreshes = new Set<() => void>();
	const wrapper: typeof fetch = async (input, init) => {
		if (!isDataRequest(page, input)) return original.call(page, input, init);
		const waiting = [...refreshes];
		const response = await original.call(page, input, init).catch(() => undefined);
		if (response && !(await isPassingFailure(response))) return response;
		for (const failed of waiting) failed();
		// Left pending so SvelteKit drops this load; refreshes settle through failed() instead.
		return new Promise<Response>(() => {});
	};
	const guard = { original, wrapper, refreshes };
	page.fetch = wrapper;
	guards.set(page, guard);
	return guard;
}

function isDataRequest(page: PageWindow, input: RequestInfo | URL): boolean {
	const dataPath = `${page.location.pathname.replace(/\/$/, '')}/__data.json`;
	return new URL(requestUrl(input), 'http://page').pathname === dataPath;
}

function requestUrl(input: RequestInfo | URL): string {
	return input instanceof Request ? input.url : input.toString();
}

async function isPassingFailure(response: Response): Promise<boolean> {
	if (response.status === 404) return false;
	if (!response.ok) return true;
	const type = response.headers.get('content-type') ?? '';
	if (type.includes('text/sveltekit-data')) return false;
	// A proxy or captive portal can answer 200 with its own page, which SvelteKit cannot read.
	if (!type.includes('application/json')) return true;
	const body = (await response
		.clone()
		.json()
		.catch(() => undefined)) as { nodes?: DataNode[] } | undefined;
	if (!body) return true;
	return (body.nodes ?? []).some((node) => node?.type === 'error' && node.error?.status !== 404);
}

interface DataNode {
	type: string;
	error?: { status?: number };
}
