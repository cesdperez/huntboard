import type { ActionResult } from '$app/forms';
import { refreshGameData } from '#lib/components/connection/index.js';
import { RETRY } from '#lib/components/team/action-message.js';
import { toast } from '#lib/components/toast/index.js';

interface Settled {
	result: ActionResult;
	update: (options?: { reset?: boolean }) => Promise<void>;
}

/**
 * The default enhance update, except for a request that got no answer the page understands: the
 * form keeps what was typed and a toast asks to retry, where the error page would replace it.
 * A 404 still shows the error page, because then the admin link itself stopped working.
 */
export async function updateOrRetry(
	{ result, update }: Settled,
	options?: { reset?: boolean }
): Promise<void> {
	if (result.type === 'error' && result.status !== 404) {
		toast.show(RETRY);
		await refreshGameData().catch(() => {});
		return;
	}
	await update(options);
}
