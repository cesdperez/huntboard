import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putFile, UPLOAD_STALL_MS } from './media-upload.js';

type Handler = ((event: ProgressEvent) => void) | null;

// Node has no ProgressEvent, and putFile reads only the progress fields.
const EVENT = {} as ProgressEvent;

/** Just enough XMLHttpRequest for putFile, driven by the test. */
class FakeRequest {
	static last: FakeRequest;
	status = 0;
	upload: { onprogress: Handler; onload: Handler } = { onprogress: null, onload: null };
	onload: Handler = null;
	onerror: Handler = null;
	onabort: Handler = null;
	aborted = false;

	constructor() {
		FakeRequest.last = this;
	}

	open() {}
	setRequestHeader() {}
	send() {}

	abort() {
		this.aborted = true;
		this.onabort?.(EVENT);
	}

	progress(loaded: number) {
		this.upload.onprogress?.({ lengthComputable: true, loaded, total: 10 } as ProgressEvent);
	}

	answer(status: number) {
		this.status = status;
		this.onload?.(EVENT);
	}

	fail() {
		this.onerror?.(EVENT);
	}
}

const FILE = new Blob(['photo']);

function put(signal = new AbortController().signal) {
	const onProgress = vi.fn();
	const done = putFile('https://r2.example/put', {}, FILE, onProgress, signal);
	return { done, onProgress, request: FakeRequest.last };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('XMLHttpRequest', FakeRequest);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('putFile', () => {
	it('reports progress and resolves uploaded on a 2xx answer', async () => {
		const { done, onProgress, request } = put();
		request.progress(5);
		request.answer(200);

		expect(onProgress).toHaveBeenCalledWith(0.5);
		expect(await done).toBe('uploaded');
	});

	it.each([400, 403, 413])('resolves refused when storage answers %i', async (status) => {
		const { done, request } = put();
		request.answer(status);

		expect(await done).toBe('refused');
	});

	it('resolves failed on a network error or a server error', async () => {
		const first = put();
		first.request.fail();
		const second = put();
		second.request.answer(503);

		expect(await first.done).toBe('failed');
		expect(await second.done).toBe('failed');
	});

	it('gives up as stalled when no progress comes for a while', async () => {
		const { done, request } = put();
		vi.advanceTimersByTime(UPLOAD_STALL_MS);

		expect(request.aborted).toBe(true);
		expect(await done).toBe('stalled');
	});

	it('keeps going while progress comes', async () => {
		const { done, request } = put();
		vi.advanceTimersByTime(UPLOAD_STALL_MS - 1);
		request.progress(3);
		vi.advanceTimersByTime(UPLOAD_STALL_MS - 1);
		request.answer(200);

		expect(request.aborted).toBe(false);
		expect(await done).toBe('uploaded');
	});

	it('rejects with the reason when stopped', async () => {
		const controller = new AbortController();
		const { done } = put(controller.signal);
		controller.abort('removed');

		await expect(done).rejects.toBe('removed');
	});
});
