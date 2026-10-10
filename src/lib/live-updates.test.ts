import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

	it('skips a refresh while the previous one is still running', async () => {
		let finish = () => {};
		refresh.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		start();

		win.dispatchEvent(new Event('focus'));
		doc.set('visible');
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);

		finish();
		await vi.advanceTimersByTimeAsync(15_000);
		expect(refresh).toHaveBeenCalledTimes(2);
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
});
