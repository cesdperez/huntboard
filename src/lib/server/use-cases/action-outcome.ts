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
