import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipboardCopy } from './clipboard-copy.svelte.js';

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
	vi.useFakeTimers();
	writeText = vi.fn(async () => {});
	vi.stubGlobal('navigator', { clipboard: { writeText } });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('ClipboardCopy', () => {
	it('says copied for two seconds, then goes back to idle', async () => {
		const clipboard = new ClipboardCopy();
		expect(await clipboard.copy('hello')).toBe(true);
		expect(writeText).toHaveBeenCalledWith('hello');
		expect(clipboard.state).toBe('copied');
		vi.advanceTimersByTime(2000);
		expect(clipboard.state).toBe('idle');
	});

	it('restarts the two seconds on a second copy', async () => {
		const clipboard = new ClipboardCopy();
		await clipboard.copy('one');
		vi.advanceTimersByTime(1500);
		await clipboard.copy('two');
		vi.advanceTimersByTime(1500);
		expect(clipboard.state).toBe('copied');
	});

	it('says blocked when the browser refuses, and stays so', async () => {
		writeText.mockRejectedValue(new Error('denied'));
		const clipboard = new ClipboardCopy();
		expect(await clipboard.copy('hello')).toBe(false);
		vi.advanceTimersByTime(2000);
		expect(clipboard.state).toBe('blocked');
	});
});
