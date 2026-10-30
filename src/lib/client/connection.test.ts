import { describe, expect, it, vi } from 'vitest';
import {
	DATA_TIMEOUT_MS,
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
			'a proxy or captive portal answers 200 with a web page',
			async () =>
				new Response('<html>Sign in to the Wi-Fi</html>', {
					headers: { 'content-type': 'text/html' }
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

	it('lets streamed page data through', async () => {
		const page = fakePage(
			async () =>
				new Response('{"type":"data","nodes":[]}\n', {
					headers: { 'content-type': 'text/sveltekit-data' }
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

	function deferred() {
		let answer!: (response: Response) => void;
		const response = new Promise<Response>((resolve) => (answer = resolve));
		return { response, answer };
	}

	it.each([
		['the first ends first', [0, 1]],
		['the second ends first', [1, 0]]
	])('leaves fetch as it found it after two refreshes overlap and %s', async (_case, order) => {
		const answers = [deferred(), deferred()];
		const page = fakePage(() => answers.shift()!.response);
		const pending = [answers[0], answers[1]];
		const refreshes = [
			refreshKeepingPage(loadData(page).refresh, page),
			refreshKeepingPage(loadData(page).refresh, page)
		];

		for (const index of order) {
			pending[index].answer(Response.json({ type: 'data', nodes: [] }));
			expect(await refreshes[index]).toBe(true);
		}

		expect(page.fetch).toBe(page.original);
	});

	it('reports no update when a data request fails after two refreshes overlapped', async () => {
		const answers = [deferred(), deferred()];
		const page = fakePage(
			() => answers.shift()?.response ?? Promise.resolve(new Response('', { status: 503 }))
		);
		const pending = [answers[0], answers[1]];
		const first = refreshKeepingPage(loadData(page).refresh, page);
		const second = refreshKeepingPage(loadData(page).refresh, page);
		pending[0].answer(Response.json({ type: 'data', nodes: [] }));
		await first;
		pending[1].answer(Response.json({ type: 'data', nodes: [] }));
		await second;

		const { loaded, refresh } = loadData(page);
		expect(await refreshKeepingPage(refresh, page)).toBe(false);
		expect(loaded).not.toHaveBeenCalled();
		expect(page.fetch).toBe(page.original);
	});

	it('reports no update once a stalled data request times out', async () => {
		vi.useFakeTimers();
		try {
			const page = fakePage(() => new Promise<Response>(() => {}));

			const refreshed = refreshKeepingPage(loadData(page).refresh, page);
			await vi.advanceTimersByTimeAsync(DATA_TIMEOUT_MS);

			expect(await refreshed).toBe(false);
			expect(page.fetch).toBe(page.original);
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps the page when a data request fails after its refresh timed out', async () => {
		vi.useFakeTimers();
		try {
			const stalled = deferred();
			const page = fakePage(() => stalled.response);
			const { loaded, refresh } = loadData(page);

			const refreshed = refreshKeepingPage(refresh, page);
			await vi.advanceTimersByTimeAsync(DATA_TIMEOUT_MS);
			expect(await refreshed).toBe(false);
			stalled.answer(new Response('', { status: 503 }));
			await vi.advanceTimersByTimeAsync(0);

			expect(loaded).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
