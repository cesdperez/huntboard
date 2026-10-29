import type { MediaBucket } from '../storage/media-store.js';

interface StoredObject {
	bytes: Uint8Array<ArrayBuffer>;
	contentType: string | undefined;
	uploaded: Date;
}

/** In-memory stand-in for the subset of R2Bucket that the image and media stores use. Tests only. */
export class MemoryBucket {
	readonly objects = new Map<string, StoredObject>();
	/** Page size for list(), small enough for tests to cover the cursor. */
	listLimit = 1000;
	failDeletes = false;

	keys(): string[] {
		return [...this.objects.keys()].sort();
	}

	async put(key: string, value: Uint8Array<ArrayBuffer>, options?: R2PutOptions) {
		const metadata = options?.httpMetadata;
		const contentType = metadata instanceof Headers ? undefined : metadata?.contentType;
		this.objects.set(key, { bytes: value, contentType, uploaded: new Date() });
		return { key };
	}

	async head(key: string) {
		return this.#describe(key);
	}

	#describe(key: string) {
		const object = this.objects.get(key);
		if (!object) return null;
		return {
			key,
			size: object.bytes.length,
			uploaded: object.uploaded,
			httpEtag: `"${key}"`,
			httpMetadata: { contentType: object.contentType }
		};
	}

	/** Takes only an offset and length range, which is all the stores ask R2 for. */
	async get(key: string, options?: R2GetOptions) {
		const head = this.#describe(key);
		if (!head) return null;
		const range = options?.range as { offset: number; length?: number } | undefined;
		const bytes = this.objects.get(key)!.bytes;
		const body = range
			? bytes.slice(
					range.offset,
					range.length === undefined ? undefined : range.offset + range.length
				)
			: bytes;
		return { ...head, range, body: new Blob([body]).stream() };
	}

	async delete(keys: string | string[]) {
		if (this.failDeletes) throw new Error('R2 is down');
		for (const key of [keys].flat()) this.objects.delete(key);
	}

	async list(options: R2ListOptions = {}) {
		const matching = this.keys().filter((key) => key.startsWith(options.prefix ?? ''));
		const start = Number(options.cursor ?? 0);
		const page = matching.slice(start, start + this.listLimit);
		const truncated = start + page.length < matching.length;
		return {
			objects: page.map((key) => ({ key })),
			truncated,
			...(truncated && { cursor: String(start + page.length) }),
			delimitedPrefixes: []
		};
	}

	asBucket(): MediaBucket {
		return this as unknown as MediaBucket;
	}
}
