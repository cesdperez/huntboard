/** How an upload ended: refused is a 4xx answer, which sending the same request again will not fix. */
export type PutOutcome = 'uploaded' | 'refused' | 'failed' | 'stalled';

/** An upload with no progress for this long gives up, so a dead connection cannot hold it forever. */
export const UPLOAD_STALL_MS = 30_000;

/**
 * PUTs a file to a presigned URL. XMLHttpRequest, because fetch reports no upload progress.
 * Rejects with the signal's reason once stopped.
 */
export function putFile(
	url: string,
	headers: Record<string, string>,
	file: Blob,
	onProgress: (fraction: number) => void,
	signal: AbortSignal
): Promise<PutOutcome> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		let stalled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const watch = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				stalled = true;
				request.abort();
			}, UPLOAD_STALL_MS);
		};
		const settle = (outcome: PutOutcome) => {
			clearTimeout(timer);
			resolve(outcome);
		};

		request.open('PUT', url);
		for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) => {
			watch();
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		// Every byte is sent, and the answer still has to come.
		request.upload.onload = watch;
		request.onload = () => settle(outcomeOf(request.status));
		request.onerror = () => settle('failed');
		request.onabort = () => {
			if (stalled) return settle('stalled');
			clearTimeout(timer);
			reject(signal.reason);
		};
		signal.addEventListener('abort', () => request.abort(), { once: true });
		watch();
		request.send(file);
	});
}

function outcomeOf(status: number): PutOutcome {
	if (status >= 200 && status < 300) return 'uploaded';
	return status >= 400 && status < 500 ? 'refused' : 'failed';
}
