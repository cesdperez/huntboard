import { applyAction, type SubmitFunction } from '$app/forms';
import { nickname } from '#lib/components/nickname/index.js';
import { FormAction } from '#lib/components/form-action.svelte.js';
import { resultUnder, type ActionResults, type KindResultKey } from '#lib/action-results.js';
import { adminFailureMessage } from './admin-message.js';

/**
 * Busy and error state of an admin form, and its enhance callback. The action puts its result
 * under `key`. Every admin form sends the viewer's nickname, so the server knows who did it.
 */
export class AdminAction<K extends KindResultKey> extends FormAction<ActionResults[K]> {
	readonly #key: K;
	#destroyed = false;

	/** Create it while a component initialises. subject is what the form acts on. */
	constructor(key: K, subject?: () => unknown) {
		super(subject);
		this.#key = key;
		// The refresh after a request can remove the component, and its props go stale with it.
		$effect(() => () => (this.#destroyed = true));
	}

	submit(
		onsuccess: (result: ActionResults[K], formData: FormData) => void,
		onfailure?: (message: string) => void
	): SubmitFunction {
		return ({ formData }) => {
			formData.set('nickname', nickname.value ?? '');
			this.start();
			return async ({ result }) => {
				if (result.type === 'redirect') return applyAction(result);
				const message = result.type === 'success' ? null : adminFailureMessage(result, this.#key);
				// Before the refresh, so a parent can keep in view an item the refresh removes.
				if (message) onfailure?.(message);
				await this.refresh();
				if (result.type === 'success') {
					onsuccess(resultUnder(result.data, this.#key) as ActionResults[K], formData);
					return;
				}
				this.recordFailure(
					message,
					result.type === 'failure' ? resultUnder(result.data, this.#key) : undefined,
					this.#destroyed ? null : this.currentSubject()
				);
			};
		};
	}
}
