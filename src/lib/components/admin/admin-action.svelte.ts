import { applyAction, type ActionResult, type SubmitFunction } from '$app/forms';
import { nickname } from '#lib/components/nickname/index.js';
import { FormAction, type Recheck } from '#lib/components/form-action.svelte.js';
import { resultUnder, type ActionResults, type ErrorResultKey } from '#lib/action-results.js';
import { adminFailureMessage, needsRetry } from './admin-message.js';

/** Whether a request that lost its answer went through, or the answer it should have had. */
export type LostAnswer = boolean | ActionResult | Promise<boolean | ActionResult>;

/**
 * Busy and error state of an admin form, and its enhance callback. The action puts its result
 * under `key`. Every admin form sends the viewer's nickname, so the server knows who did it.
 */
export class AdminAction<K extends ErrorResultKey> extends FormAction<ActionResults[K]> {
	readonly #key: K;
	#destroyed = false;

	/** Create it while a component initialises. subject is what the form acts on. */
	constructor(key: K, subject?: () => unknown) {
		super(subject);
		this.#key = key;
		// The refresh after a request can remove the component, and its props go stale with it.
		$effect(() => () => (this.#destroyed = true));
	}

	/**
	 * onfailure gets every error before the page refreshes, and null while a lost answer is being
	 * checked. recheck tells what a request that lost its answer did, from the refreshed page.
	 */
	submit(
		onsuccess: (result: ActionResults[K] | undefined, formData: FormData) => void,
		onfailure?: (message: string | null) => void,
		recheck?: Recheck<LostAnswer>
	): SubmitFunction {
		return ({ formData }) => {
			formData.set('nickname', nickname.value ?? '');
			this.start();
			const check = recheck?.(formData);
			return async ({ result: answer }) => {
				if (answer.type === 'redirect') return applyAction(answer);
				const checking = check !== undefined && needsRetry(answer);
				// Before the refresh, so a parent can keep in view an item the refresh removes.
				if (checking) onfailure?.(null);
				else if (answer.type !== 'success') {
					const message = adminFailureMessage(answer, this.#key);
					if (message) onfailure?.(message);
				}
				const current = await this.refresh();
				const rechecked =
					checking &&
					current &&
					(await Promise.resolve()
						.then(check)
						.catch(() => false));
				const result = typeof rechecked === 'object' ? rechecked : answer;
				this.busy = false;
				if (rechecked === true || result.type === 'success') {
					onsuccess(
						result.type === 'success' ? resultUnder(result.data, this.#key) : undefined,
						formData
					);
					return;
				}
				const message = adminFailureMessage(result, this.#key);
				if (checking) onfailure?.(message);
				this.recordFailure(
					message,
					result.type === 'failure' ? resultUnder(result.data, this.#key) : undefined,
					this.#destroyed ? null : this.currentSubject()
				);
			};
		};
	}
}
