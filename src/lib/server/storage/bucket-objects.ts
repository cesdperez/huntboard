const MAX_KEYS_PER_DELETE = 1000;

/**
 * Best effort: the database no longer points at these keys, so a failed delete leaves an
 * unreachable object, which the next sweep of the game removes.
 */
export async function deleteObjects(
	bucket: Pick<R2Bucket, 'delete'>,
	keys: (string | null)[]
): Promise<void> {
	const present = keys.filter((key) => key !== null);
	if (present.length === 0) return;
	try {
		await bucket.delete(present);
	} catch (error) {
		console.error('Deleting objects failed', present, error);
	}
}

/** Deletes every object stored under the game id, including any a failed delete left behind. */
export async function deleteGameObjects(
	bucket: Pick<R2Bucket, 'list' | 'delete'>,
	gameId: number
): Promise<void> {
	const keys: string[] = [];
	let cursor: string | undefined;
	// Lists everything before deleting, so deleting cannot shift the pages still to come.
	do {
		const page = await bucket.list({ prefix: `${gameId}/`, cursor });
		keys.push(...page.objects.map((object) => object.key));
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);

	for (let start = 0; start < keys.length; start += MAX_KEYS_PER_DELETE) {
		await deleteObjects(bucket, keys.slice(start, start + MAX_KEYS_PER_DELETE));
	}
}
