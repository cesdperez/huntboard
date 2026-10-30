import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_TIMEOUT_MS, refreshKeepingPage } from './connection.js';
import { startPolling } from './live-updates.js';

class FakeDocument extends EventTarget {
	visibilityState: DocumentVisibilityState = 'visible';

	set(state: DocumentVisibilityState) {
		this.visibilityState = state;
		this.dispatchEvent(new Event('visibilitychange'));
	}
}

let doc: FakeDocument;
let win: EventTarget;
let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;

function start() {
	return startPolling(refresh, { intervalMs: 15_000, document: doc, window: win });
}

beforeEach(() => {
	vi.useFakeTimers();
	doc = new FakeDocument();
	win = new EventTarget();
	refresh = vi.fn(() => Promise.resolve());
});

afterEach(() => {
	vi.useRealTimers();
});

describe('startPolling', () => {
	it('refreshes once per interval while the page is visible', async () => {
		start();

		await vi.advanceTimersByTimeAsync(14_999);
		expect(refresh).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('pauses while the page is hidden', async () => {
		start();
		doc.set('hidden');

		await vi.advanceTimersByTimeAsync(60_000);

		expect(refresh).not.toHaveBeenCalled();
	});

	it('does not poll when it starts on a hidden page', async () => {
		doc.visibilityState = 'hidden';
		start();

		await vi.advanceTimersByTimeAsync(60_000);

		expect(refresh).not.toHaveBeenCalled();
	});

	it('refreshes at once when the page shows again, then counts a full interval from there', async () => {
		start();
		doc.set('hidden');
		await vi.advanceTimersByTimeAsync(40_000);

		doc.set('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(14_999);
		expect(refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('refreshes at once on focus and restarts the interval', async () => {
		start();
		await vi.advanceTimersByTimeAsync(10_000);

		win.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(14_999);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('refreshes at once when the connection comes back', async () => {
		start();
		await vi.advanceTimersByTimeAsync(10_000);

		win.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('runs one follow-up refresh for events that arrive while a refresh is running', async () => {
		let finish = () => {};
		refresh.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		start();

		win.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(0);
		win.dispatchEvent(new Event('online'));
		doc.set('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);

		finish();
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(2);
		finish();
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('skips an interval tick while a refresh is still running', async () => {
		let finish = () => {};
		refresh.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		start();

		await vi.advanceTimersByTimeAsync(30_000);
		finish();
		await vi.advanceTimersByTimeAsync(0);

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('keeps polling after a refresh fails', async () => {
		refresh.mockRejectedValueOnce(new Error('offline'));
		start();

		await vi.advanceTimersByTimeAsync(30_000);

		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('stops polling and listening once stopped', async () => {
		const stop = start();
		stop();

		await vi.advanceTimersByTimeAsync(60_000);
		win.dispatchEvent(new Event('focus'));
		win.dispatchEvent(new Event('online'));
		doc.set('visible');
		await vi.advanceTimersByTimeAsync(0);

		expect(refresh).not.toHaveBeenCalled();
	});

	describe('with refreshes that keep the page', () => {
		const DATA_URL = '/t/abc/__data.json';

		function pageAnswering(answer: () => Promise<Response>) {
			const requests = vi.fn(answer);
			const page = { fetch: requests as typeof fetch, location: { pathname: '/t/abc' } };
			const refreshPage = () => refreshKeepingPage(() => page.fetch(DATA_URL), page);
			return { requests, refreshPage };
		}

		it('keeps polling after a failure that follows two overlapping refreshes', async () => {
			const answers: Array<(response: Response) => void> = [];
			const { requests, refreshPage } = pageAnswering(
				() => new Promise<Response>((resolve) => answers.push(resolve))
			);
			refresh.mockImplementation(async () => void (await refreshPage()));
			start();

			const action = refreshPage();
			win.dispatchEvent(new Event('focus'));
			await vi.advanceTimersByTimeAsync(0);
			answers[0](Response.json({ type: 'data', nodes: [] }));
			answers[1](Response.json({ type: 'data', nodes: [] }));
			await action;
			await vi.advanceTimersByTimeAsync(15_000);
			answers[2](new Response('', { status: 503 }));
			await vi.advanceTimersByTimeAsync(15_000);

			expect(refresh).toHaveBeenCalledTimes(3);
			expect(requests).toHaveBeenCalledTimes(4);
		});

		it('runs the next poll once a stalled data request times out', async () => {
			const { refreshPage } = pageAnswering(() => new Promise<Response>(() => {}));
			refresh.mockImplementation(async () => void (await refreshPage()));
			start();

			win.dispatchEvent(new Event('focus'));
			await vi.advanceTimersByTimeAsync(DATA_TIMEOUT_MS);
			win.dispatchEvent(new Event('focus'));
			await vi.advanceTimersByTimeAsync(0);

			expect(refresh).toHaveBeenCalledTimes(2);
		});
	});
});
