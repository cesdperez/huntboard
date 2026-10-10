import type { ActionResult } from '$app/forms';
import { RETRY } from '#lib/components/team/action-message.js';

const DEAD_ADMIN_LINK =
	'This admin link does not work any more. Ask a fellow admin for the current link.';

/**
 * What to show after an admin action, or null when it went through or its form shows the
 * errors field by field. key is where the action puts its result, like `judge`.
 */
export function adminFailureMessage(result: ActionResult, key: string): string | null {
	switch (result.type) {
		case 'success':
		case 'redirect':
			return null;
		case 'error':
			return result.status === 404 ? DEAD_ADMIN_LINK : RETRY;
		case 'failure': {
			const data = result.data?.[key] as { kind: string; message?: string } | undefined;
			if (!data) return RETRY;
			return data.kind === 'error' ? (data.message ?? RETRY) : null;
		}
	}
}

/**
 * Whether a request got no answer the page understands, so a form keeps what was typed for a
 * retry. A 404 is an answer: the admin link itself stopped working.
 */
export function needsRetry(result: ActionResult): boolean {
	return result.type === 'error' && result.status !== 404;
}
