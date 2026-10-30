import type { ActionResult } from '$app/forms';
import { focusIfLost } from '#lib/client/focus.js';
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
 * typed and a toast asks to retry, where the error page would replace it. Focus stays on the
 * control that sent the form while that control is still on the page.
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
	const focused = document.activeElement;
	await update(options);
	// After a success SvelteKit moves focus to the page top, as it does after a navigation.
	if (focused instanceof HTMLElement && focused.isConnected) focusIfLost(focused);
}
