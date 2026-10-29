import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from './toast-store.svelte.js';

describe('toast', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.runAllTimers();
		vi.useRealTimers();
	});

	it('shows queued messages one after another, then nothing', () => {
		toast.queue('Scored 8 for A', 'Scored 5 for B');
		expect(toast.message).toBe('Scored 8 for A');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBe('Scored 5 for B');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBeNull();
	});

	it('waits for the message showing before a queued one', () => {
		toast.show('Marked done');
		toast.queue('Scored 8 for A');
		expect(toast.message).toBe('Marked done');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBe('Scored 8 for A');
	});

	it('shows a queued message again after a confirmation cuts it short', () => {
		toast.queue('Scored 8 for A');
		toast.show('Marked done');
		expect(toast.message).toBe('Marked done');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBe('Scored 8 for A');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBeNull();
	});

	it('replaces one confirmation with the next', () => {
		toast.show('Scored 15');
		toast.show('Scored 12');
		vi.advanceTimersByTime(3000);
		expect(toast.message).toBeNull();
	});
});
