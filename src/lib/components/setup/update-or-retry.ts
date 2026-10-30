import { applyAction, type ActionResult } from '$app/forms';
import { focusIfLost } from '#lib/client/focus.js';
import { needsRetry } from '#lib/components/admin/admin-message.js';
import { connection, refreshGameData, reportOnline } from '#lib/components/connection/index.js';
import { RETRY } from '#lib/components/team/action-message.js';
import { toast } from '#lib/components/toast/index.js';

type Landed = boolean | Record<string, unknown>;

interface Settled {
	result: ActionResult;
	formElement: HTMLFormElement;
	update: (options?: { reset?: boolean }) => Promise<void>;
}

export interface UpdateOptions {
	/** False keeps what the form holds after a success. */
	reset?: boolean;
	/**
	 * Tells from the refreshed page whether a request that lost its answer went through, or the data
	 * its answer would have carried. Make it as the request leaves, to note the state it started from.
	 */
	tookEffect?: () => Landed | Promise<Landed>;
}

/**
 * The enhance update, refreshing the page the way polls do, so a failed reload keeps Setup and
 * what was typed. A request that lost its answer counts as done when tookEffect finds it on the
 * refreshed page, and otherwise keeps what was typed and asks for a retry in a toast. Resolves the
 * answer it applied. Focus stays on the control that sent the form while it is still on the page.
 */
export async function updateOrRetry(
	settled: Settled,
	{ reset = true, tookEffect }: UpdateOptions = {}
): Promise<ActionResult> {
	const focused = document.activeElement;
	const lost = needsRetry(settled.result);
	const result = lost ? await recheck(tookEffect) : settled.result;
	if (!result) {
		toast.show(RETRY);
		return settled.result;
	}
	// A dead link shows its page, and a redirect moves to its page.
	if (result.type === 'error' || result.type === 'redirect') {
		await settled.update({ reset });
		return result;
	}
	reportOnline(true);
	if (result.type === 'success') {
		// From the prototype, like SvelteKit, in case a field is named "reset".
		if (reset) HTMLFormElement.prototype.reset.call(settled.formElement);
		if (!lost) await refreshGameData().catch(() => {});
	}
	await applyAction(result);
	// After a success SvelteKit moves focus to the page top, as it does after a navigation.
	if (focused instanceof HTMLElement && focused.isConnected) focusIfLost(focused);
	return result;
}

async function recheck(tookEffect: UpdateOptions['tookEffect']): Promise<ActionResult | null> {
	await refreshGameData().catch(() => {});
	if (!tookEffect || !connection.online || connection.stale) return null;
	const landed = await Promise.resolve()
		.then(tookEffect)
		.catch(() => false);
	if (!landed) return null;
	const data = landed === true ? undefined : landed;
	return { type: 'success', status: 200, data, location: location.pathname + location.search };
}
