import { applyAction, type SubmitFunction } from '$app/forms';
import { invalidate } from '$app/navigation';
import { nickname } from '#lib/components/nickname/index.js';
import { GAME_DATA } from '#lib/live-updates.js';
import { adminFailureMessage } from './admin-message.js';

interface Failure<T> {
	message: string | null;
	result: T | undefined;
	subject: unknown;
}

/**
 * Busy and error state of an admin form, and its enhance callback. The action puts its result
 * under `key`. Every admin form sends the viewer's nickname, so the server knows who did it.
 */
export class AdminAction<T> {
	busy = $state(false);
	#failure = $state<Failure<T> | null>(null);
	readonly #key: string;
	readonly #subject: () => unknown;
	#destroyed = false;

	/**
	 * Create it while a component initialises. subject is what the form acts on. An error hides
	 * once a poll changes it, so it never describes a stale state.
	 */
	constructor(key: string, subject: () => unknown = () => null) {
		this.#key = key;
		this.#subject = subject;
		// The refresh after a request can remove the component, and its props go stale with it.
		$effect(() => () => (this.#destroyed = true));
	}

	get error(): string | null {
		return this.#current()?.message ?? null;
	}

	/** The failed result, for forms that show errors field by field. */
	get failed(): T | undefined {
		return this.#current()?.result;
	}

	clearError() {
		this.#failure = null;
	}

	submit(
		onsuccess: (result: T, formData: FormData) => void,
		onfailure?: (message: string) => void
	): SubmitFunction {
		return ({ formData }) => {
			formData.set('nickname', nickname.value ?? '');
			this.busy = true;
			this.#failure = null;
			return async ({ result }) => {
				if (result.type === 'redirect') return applyAction(result);
				const message = result.type === 'success' ? null : adminFailureMessage(result, this.#key);
				// Before the refresh, so a parent can keep in view an item the refresh removes.
				if (message) onfailure?.(message);
				// Refresh either way: a failure usually means someone else changed the same thing.
				await invalidate(GAME_DATA).catch(() => {});
				this.busy = false;
				if (result.type === 'success') {
					onsuccess(result.data?.[this.#key] as T, formData);
					return;
				}
				this.#failure = {
					message,
					result: result.type === 'failure' ? (result.data?.[this.#key] as T) : undefined,
					subject: this.#destroyed ? null : this.#subject()
				};
			};
		};
	}

	#current(): Failure<T> | null {
		const failure = this.#failure;
		return failure && failure.subject === this.#subject() ? failure : null;
	}
}
