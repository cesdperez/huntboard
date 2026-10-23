import { fail } from '@sveltejs/kit';
import type { ActionKey, ActionResults } from '#lib/action-results.js';
import type { ActionOutcome } from '#lib/server/use-cases/action-outcome.js';

/** The form action response that puts the result under `page.form[key]`. */
export function respond<K extends ActionKey>(
	key: K,
	{ status, result }: ActionOutcome<ActionResults[K]>
) {
	const data = { [key]: result } as Record<K, ActionResults[K]>;
	return status === 200 ? data : fail(status, data);
}
