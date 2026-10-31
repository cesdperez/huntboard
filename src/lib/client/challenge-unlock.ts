// Retries cover a browser clock that runs a few seconds ahead of the server's.
export const UNLOCK_RETRY_MS = 3_000;
export const UNLOCK_ATTEMPTS = 5;

/**
 * Refreshes at once, then again every UNLOCK_RETRY_MS while isLocked() holds, up to
 * UNLOCK_ATTEMPTS refreshes. After that the regular polling takes over. Returns a function that stops it.
 */
export function refreshUntilUnlocked(
	refresh: () => Promise<unknown>,
	isLocked: () => boolean
): () => void {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function attempt(left: number) {
		try {
			await refresh();
		} catch {
			// Offline or a failed load: the next attempt tries again.
		}
		if (stopped || left <= 1 || !isLocked()) return;
		timer = setTimeout(() => void attempt(left - 1), UNLOCK_RETRY_MS);
	}

	void attempt(UNLOCK_ATTEMPTS);
	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}
