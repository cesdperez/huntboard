import { describe, expect, it, vi } from 'vitest';
import {
	isReachable,
	REACHABLE_TIMEOUT_MS,
	refreshIfReachable,
	refreshKeepingPage,
	REACHABLE_URL
} from './connection.js';

describe('isReachable', () => {
	it('fetches the static file past the browser cache', async () => {
		const fetcher = vi.fn(async () => new Response('ok'));

		expect(await isReachable(fetcher)).toBe(true);
		expect(fetcher).toHaveBeenCalledWith(
			REACHABLE_URL,
			expect.objectContaining({ cache: 'no-store' })
		);
	});

	it('is false when the request fails', async () => {
		const fetcher = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});

		expect(await isReachable(fetcher)).toBe(false);
	});

	it('is false once a stalled request times out', async () => {
		vi.useFakeTimers();
		try {
			const fetcher = vi.fn(
				(_url: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
					})
			);

			const reachable = isReachable(fetcher);
			await vi.advanceTimersByTimeAsync(REACHABLE_TIMEOUT_MS);

			expect(await reachable).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('is false on an error status, as a captive portal or a down host answers', async () => {
		const fetcher = vi.fn(async () => new Response('', { status: 503 }));

		expect(await isReachable(fetcher)).toBe(false);
	});
});

describe('refreshIfReachable', () => {
	it('refreshes and reports online when the server is reachable', async () => {
		const refresh = vi.fn(async () => {});
		const report = vi.fn();

		await refreshIfReachable(refresh, report, async () => true);

		expect(report).toHaveBeenCalledWith(true);
		expect(refresh).toHaveBeenCalledOnce();
	});

	it('keeps the page as it is and reports offline when the server is out of reach', async () => {
		const refresh = vi.fn(async () => {});
		const report = vi.fn();

		await refreshIfReachable(refresh, report, async () => false);

		expect(report).toHaveBeenCalledWith(false);
		expect(refresh).not.toHaveBeenCalled();
	});
});

describe('refreshKeepingPage', () => {
	const DATA_URL = '/t/abc/__data.json?x-sveltekit-invalidated=01';

	function fakePage(answer: () => Promise<Response>) {
		const original = vi.fn(answer) as unknown as typeof fetch;
		return { fetch: original, location: { pathname: '/t/abc' }, original };
	}

	function loadData(page: { fetch: typeof fetch }, url = DATA_URL) {
		const loaded = vi.fn();
		return { loaded, refresh: async () => loaded(await page.fetch(url)) };
	}

	it('updates when the page data loads', async () => {
		const page = fakePage(async () => Response.json({ type: 'data', nodes: [] }));
		const { loaded, refresh } = loadData(page);

		expect(await refreshKeepingPage(refresh, page)).toBe(true);
		expect(loaded).toHaveBeenCalledOnce();
	});

	it.each([
		['the server answers an error status', async () => new Response('', { status: 503 })],
		['the zone rate limit answers', async () => new Response('', { status: 429 })],
		[
			'a load fails on the server',
			async () =>
				Response.json({
					type: 'data',
					nodes: [{ type: 'error', error: { status: 500, message: 'Internal Error' } }]
				})
		],
		[
			'the request fails',
			async () => {
				throw new TypeError('Failed to fetch');
			}
		]
	])('keeps the page and reports no update when %s', async (_case, answer) => {
		const page = fakePage(answer);
		const { loaded, refresh } = loadData(page);

		expect(await refreshKeepingPage(refresh, page)).toBe(false);
		await new Promise((resolve) => setTimeout(resolve));
		expect(loaded).not.toHaveBeenCalled();
		expect(page.fetch).toBe(page.original);
	});

	it('lets a dead link through, so the page says the link no longer works', async () => {
		const page = fakePage(async () =>
			Response.json({
				type: 'data',
				nodes: [{ type: 'error', error: { status: 404, message: 'Not found' } }]
			})
		);
		const { loaded, refresh } = loadData(page);

		expect(await refreshKeepingPage(refresh, page)).toBe(true);
		expect(loaded).toHaveBeenCalledOnce();
	});

	it('leaves requests for other pages alone', async () => {
		const page = fakePage(async () => new Response('', { status: 503 }));
		const { loaded, refresh } = loadData(page, '/s/xyz/__data.json');

		expect(await refreshKeepingPage(refresh, page)).toBe(true);
		expect(loaded).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
	});
});
