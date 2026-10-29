/**
 * PUTs a file to a presigned URL. XMLHttpRequest, because fetch reports no upload progress.
 * Resolves true on a 2xx answer, false on any other answer or a network error.
 */
export function putFile(
	url: string,
	headers: Record<string, string>,
	file: Blob,
	onProgress: (fraction: number) => void,
	signal: AbortSignal
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('PUT', url);
		for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		request.onload = () => resolve(request.status >= 200 && request.status < 300);
		request.onerror = () => resolve(false);
		request.onabort = () => reject(signal.reason);
		signal.addEventListener('abort', () => request.abort(), { once: true });
		request.send(file);
	});
}
