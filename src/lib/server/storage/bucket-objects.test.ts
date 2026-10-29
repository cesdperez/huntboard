import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteGameObjects, deleteObjects } from './bucket-objects.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

let bucket: MemoryBucket;

beforeEach(() => {
	bucket = new MemoryBucket();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('deleteObjects', () => {
	it('deletes the given keys and skips absent ones', async () => {
		await bucket.put('1/a', new Uint8Array());
		await bucket.put('1/b', new Uint8Array());

		await deleteObjects(bucket.asBucket(), ['1/a', null]);

		expect(bucket.keys()).toEqual(['1/b']);
	});

	it('does not throw when the bucket fails', async () => {
		bucket.failDeletes = true;

		await expect(deleteObjects(bucket.asBucket(), ['1/a'])).resolves.toBeUndefined();
	});
});

describe('deleteGameObjects', () => {
	it('deletes every object of the game, page by page, and leaves other games alone', async () => {
		bucket.listLimit = 2;
		for (const key of ['1/a', '1/b', '1/claims/c', '12/a', '2/a']) {
			await bucket.put(key, new Uint8Array());
		}

		await deleteGameObjects(bucket.asBucket(), 1);

		expect(bucket.keys()).toEqual(['12/a', '2/a']);
	});
});
