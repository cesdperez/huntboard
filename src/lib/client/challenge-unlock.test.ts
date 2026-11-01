import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNLOCK_ATTEMPTS, UNLOCK_RETRY_MS, refreshUntilUnlocked } from './challenge-unlock.js';

let locked: boolean;
let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
	vi.useFakeTimers();
	locked = true;
	refresh = vi.fn(() => Promise.resolve());
});

afterEach(() => {
	vi.useRealTimers();
});

describe('refreshUntilUnlocked', () => {
	it('refreshes at once and stops when the challenges unlock', async () => {
		refresh.mockImplementation(async () => {
			locked = false;
		});

		refreshUntilUnlocked(refresh, () => locked);
		await vi.advanceTimersByTimeAsync(UNLOCK_RETRY_MS * 3);

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('retries while the server still says locked, then gives up to the regular polling', async () => {
		refreshUntilUnlocked(refresh, () => locked);

		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(UNLOCK_RETRY_MS);
		expect(refresh).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(UNLOCK_RETRY_MS * UNLOCK_ATTEMPTS * 2);
		expect(refresh).toHaveBeenCalledTimes(UNLOCK_ATTEMPTS);
	});

	it('retries after a failed refresh', async () => {
		refresh.mockRejectedValueOnce(new Error('offline'));

		refreshUntilUnlocked(refresh, () => locked);
		await vi.advanceTimersByTimeAsync(UNLOCK_RETRY_MS);

		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('stops retrying once stopped', async () => {
		const stop = refreshUntilUnlocked(refresh, () => locked);
		await vi.advanceTimersByTimeAsync(0);

		stop();
		await vi.advanceTimersByTimeAsync(UNLOCK_RETRY_MS * UNLOCK_ATTEMPTS);

		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
