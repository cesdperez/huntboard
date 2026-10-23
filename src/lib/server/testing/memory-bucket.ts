import type { ImageBucket } from '../image-store.js';

interface StoredObject {
	bytes: Uint8Array<ArrayBuffer>;
	contentType: string | undefined;
}

/** In-memory stand-in for the subset of R2Bucket that image-store.ts uses. Tests only. */
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
		this.objects.set(key, { bytes: value, contentType });
		return { key };
	}

	async get(key: string) {
		const object = this.objects.get(key);
		if (!object) return null;
		return {
			key,
			httpEtag: `"${key}"`,
			httpMetadata: { contentType: object.contentType },
			body: new Blob([object.bytes]).stream()
		};
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

	asBucket(): ImageBucket {
		return this as unknown as ImageBucket;
	}
}
