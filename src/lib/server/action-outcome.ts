import { fail } from '@sveltejs/kit';
import type { ActionKey, ActionResults } from '#lib/action-results.js';

/** What a use case decided: the HTTP status and the result the page reads. 200 means success. */
export interface ActionOutcome<R> {
	status: number;
	result: R;
}

export interface ErrorResult {
	kind: 'error';
	message: string;
}

export function error(status: number, message: string): ActionOutcome<ErrorResult> {
	return { status, result: { kind: 'error', message } };
}

/** The form action response that puts the result under `page.form[key]`. */
export function respond<K extends ActionKey>(
	key: K,
	{ status, result }: ActionOutcome<ActionResults[K]>
) {
	const data = { [key]: result } as Record<K, ActionResults[K]>;
	return status === 200 ? data : fail(status, data);
}
