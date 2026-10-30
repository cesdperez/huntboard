import { parse, stringify } from 'devalue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreparedMedia } from '#lib/client/claim-media.js';
import { RETRY } from './action-message.js';

const mocks = vi.hoisted(() => ({ prepareClaimMedia: vi.fn(), putFile: vi.fn() }));

vi.mock('#lib/client/claim-media.js', async (importActual) => ({
	...(await importActual<typeof import('#lib/client/claim-media.js')>()),
	prepareClaimMedia: mocks.prepareClaimMedia
}));
vi.mock('#lib/client/media-upload.js', () => ({ putFile: mocks.putFile }));
// Kit's own deserialize needs the app's transport set up, which only a running app does.
vi.mock('$app/forms', () => ({
	deserialize: (text: string) => {
		const result = JSON.parse(text);
		return result.data ? { ...result, data: parse(result.data) } : result;
	}
}));

import { ClaimMediaUpload } from './claim-media-upload.svelte.js';

const TARGET = { url: 'https://r2.example/put', headers: { 'content-type': 'image/jpeg' } };
const PHOTO = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
const VIDEO = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function prepared(file: File): PreparedMedia {
	return { ok: true, file, type: file.type as 'image/jpeg' };
}

function presignAnswer(key: string) {
	const result = {
		type: 'success',
		status: 200,
		data: stringify({ team: { kind: 'media-upload', key, ...TARGET } })
	};
	return new Response(JSON.stringify(result));
}

function presignFailure(message: string) {
	const result = {
		type: 'failure',
		status: 400,
		data: stringify({ team: { kind: 'error', message } })
	};
	return new Response(JSON.stringify(result));
}

/** Rejects with the signal's reason once aborted, like the real steps. */
function untilAborted<T>(signal: AbortSignal, settle: Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		settle.then(resolve, reject);
	});
}

const fetchMock = vi.fn<typeof fetch>();
let upload: ClaimMediaUpload;
let urls: number;

beforeEach(() => {
	vi.clearAllMocks();
	urls = 0;
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++urls}`);
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
	mocks.prepareClaimMedia.mockImplementation(async (file: File) => prepared(file));
	fetchMock.mockImplementation(async () => presignAnswer('media/k1'));
	mocks.putFile.mockResolvedValue(true);
	upload = new ClaimMediaUpload((phase) => `closed ${phase}`);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('ClaimMediaUpload', () => {
	it('goes from preparing to uploading to ready with the key', async () => {
		const preparing = deferred<PreparedMedia>();
		const putting = deferred<boolean>();
		mocks.prepareClaimMedia.mockReturnValue(preparing.promise);
		mocks.putFile.mockReturnValue(putting.promise);

		const done = upload.start(PHOTO);
		expect(upload.phase).toBe('preparing');
		expect(upload.kind).toBe('photo');
		expect(upload.busy).toBe(true);

		preparing.resolve(prepared(PHOTO));
		await vi.waitFor(() => expect(upload.phase).toBe('uploading'));
		expect(upload.preview).toBe('blob:preview-1');
		expect(upload.progress).toBe(0);
		mocks.putFile.mock.calls[0][3](0.5);
		expect(upload.progress).toBe(0.5);

		putting.resolve(true);
		await done;
		expect(upload.phase).toBe('ready');
		expect(upload.key).toBe('media/k1');
		expect(upload.busy).toBe(false);
	});

	it('shows the server message when presigning fails', async () => {
		fetchMock.mockResolvedValue(presignFailure('This video is too large.'));
		await upload.start(PHOTO);
		expect(upload.phase).toBe('failed');
		expect(upload.error).toBe('This video is too large.');
		expect(mocks.putFile).not.toHaveBeenCalled();
	});

	it('fails with a retry message when storage refuses the file', async () => {
		mocks.putFile.mockResolvedValue(false);
		await upload.start(PHOTO);
		expect(upload.phase).toBe('failed');
		expect(upload.error).toBe(RETRY);
		expect(upload.key).toBeNull();
	});

	it('shows why the file cannot be prepared', async () => {
		mocks.prepareClaimMedia.mockResolvedValue({ ok: false, message: 'Too long.' });
		await upload.start(VIDEO);
		expect(upload.phase).toBe('failed');
		expect(upload.error).toBe('Too long.');
	});

	it('stays idle when cleared while preparing, even if the step ignores the abort', async () => {
		const preparing = deferred<PreparedMedia>();
		mocks.prepareClaimMedia.mockReturnValue(preparing.promise);
		const done = upload.start(PHOTO);
		upload.clear();
		preparing.resolve(prepared(PHOTO));
		await done;
		expect(upload.phase).toBe('idle');
		expect(upload.preview).toBeNull();
		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('stays idle when cleared while uploading', async () => {
		mocks.putFile.mockImplementation((_url, _headers, _file, _progress, signal: AbortSignal) =>
			untilAborted(signal, new Promise(() => {}))
		);
		const done = upload.start(PHOTO);
		await vi.waitFor(() => expect(upload.phase).toBe('uploading'));
		upload.clear();
		await done;
		expect(upload.phase).toBe('idle');
		expect(upload.error).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
	});

	it('keeps a removed upload from overwriting the next one', async () => {
		const first = deferred<PreparedMedia>();
		const second = deferred<PreparedMedia>();
		mocks.prepareClaimMedia.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const putting = deferred<boolean>();
		mocks.putFile.mockReturnValue(putting.promise);

		const firstRun = upload.start(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
		upload.clear();
		const secondRun = upload.start(PHOTO);

		first.resolve({ ok: false, message: 'First failed.' });
		await firstRun;
		expect(upload.phase).toBe('preparing');
		expect(upload.error).toBeNull();

		second.resolve(prepared(PHOTO));
		await vi.waitFor(() => expect(upload.phase).toBe('uploading'));
		expect(upload.preview).toBe('blob:preview-1');
		putting.resolve(true);
		await secondRun;
		expect(upload.phase).toBe('ready');
	});

	it('revokes the preview a removed upload would have made', async () => {
		const first = deferred<PreparedMedia>();
		const second = deferred<PreparedMedia>();
		mocks.prepareClaimMedia.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

		const firstRun = upload.start(new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
		const secondRun = upload.start(PHOTO);
		first.resolve(prepared(PHOTO));
		await firstRun;
		expect(upload.phase).toBe('preparing');
		expect(upload.preview).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();

		second.resolve(prepared(PHOTO));
		await secondRun;
		expect(upload.phase).toBe('ready');
	});

	it('keeps a finished upload when unfinished work stops', async () => {
		await upload.start(PHOTO);
		upload.stopUnfinished();
		expect(upload.phase).toBe('ready');
		expect(upload.key).toBe('media/k1');
		expect(upload.preview).toBe('blob:preview-1');
		expect(URL.revokeObjectURL).not.toHaveBeenCalled();
	});

	it('stops an upload still on its way when unfinished work stops', async () => {
		mocks.putFile.mockImplementation((_url, _headers, _file, _progress, signal: AbortSignal) =>
			untilAborted(signal, new Promise(() => {}))
		);
		const done = upload.start(PHOTO);
		await vi.waitFor(() => expect(upload.phase).toBe('uploading'));
		upload.stopUnfinished();
		await done;
		expect(upload.phase).toBe('idle');
		expect(upload.key).toBeNull();
	});

	it('forgets a failed file when unfinished work stops', async () => {
		mocks.putFile.mockResolvedValue(false);
		await upload.start(PHOTO);
		upload.stopUnfinished();
		expect(upload.phase).toBe('idle');
		expect(upload.error).toBeNull();
	});

	it('treats a video with no type as a video', async () => {
		const untyped = new File(['video'], 'clip.MOV');
		const preparing = deferred<PreparedMedia>();
		mocks.prepareClaimMedia.mockReturnValue(preparing.promise);
		const done = upload.start(untyped);
		expect(upload.kind).toBe('video');

		preparing.resolve({
			ok: true,
			file: new File(['video'], 'clip.MOV', { type: 'video/quicktime' }),
			type: 'video/quicktime'
		});
		await done;
		expect(upload.phase).toBe('ready');
		expect(upload.preview).toBeNull();
	});
});
