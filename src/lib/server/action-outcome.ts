import { fail } from '@sveltejs/kit';

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
export function respond<K extends string, R>(key: K, { status, result }: ActionOutcome<R>) {
	const data = { [key]: result } as Record<K, R>;
	return status === 200 ? data : fail(status, data);
}
