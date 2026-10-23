import type { ActionResult } from '$app/forms';
import { needsRetry } from '#lib/components/admin/admin-message.js';
import { connection, refreshGameData } from '#lib/components/connection/index.js';
import { RETRY } from '#lib/components/team/action-message.js';
import { toast } from '#lib/components/toast/index.js';

interface Settled {
	result: ActionResult;
	update: (options?: { reset?: boolean }) => Promise<void>;
}

/**
 * The default enhance update, except for a request that needs a retry: the form keeps what was
 * typed and a toast asks to retry, where the error page would replace it.
 */
export async function updateOrRetry(
	{ result, update }: Settled,
	options?: { reset?: boolean }
): Promise<void> {
	if (needsRetry(result)) {
		toast.show(RETRY);
		await refreshGameData().catch(() => {});
		return;
	}
	// Only an error result can come from a request that never reached the server.
	if (result.type !== 'error') connection.online = true;
	await update(options);
}
