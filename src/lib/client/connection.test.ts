import { describe, expect, it, vi } from 'vitest';
import {
	isReachable,
	REACHABLE_TIMEOUT_MS,
	refreshIfReachable,
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
