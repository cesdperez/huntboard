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

/**
 * Runs a background refresh of this page's data and resolves whether it updated. SvelteKit swaps
 * the page for the error page when its data request fails, which would lose open sheets and typed
 * notes over a passing server error or rate limit. So a failed data request for this page never
 * answers, the refresh is dropped, and the next poll tries again. A dead link still gets through.
 */
export async function refreshKeepingPage(
	refresh: () => Promise<unknown>,
	page: PageWindow = window
): Promise<boolean> {
	const original = page.fetch;
	const dataPath = `${page.location.pathname.replace(/\/$/, '')}/__data.json`;
	let failed!: () => void;
	const failure = new Promise<boolean>((resolve) => (failed = () => resolve(false)));

	page.fetch = async (input, init) => {
		if (new URL(requestUrl(input), 'http://page').pathname !== dataPath) {
			return original.call(page, input, init);
		}
		const response = await original.call(page, input, init).catch(() => undefined);
		if (response && !(await isPassingFailure(response))) return response;
		failed();
		return new Promise<Response>(() => {});
	};
	try {
		return await Promise.race([refresh().then(() => true), failure]);
	} finally {
		page.fetch = original;
	}
}

function requestUrl(input: RequestInfo | URL): string {
	return input instanceof Request ? input.url : input.toString();
}

async function isPassingFailure(response: Response): Promise<boolean> {
	if (response.status === 404) return false;
	if (!response.ok) return true;
	if (!response.headers.get('content-type')?.includes('application/json')) return false;
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
