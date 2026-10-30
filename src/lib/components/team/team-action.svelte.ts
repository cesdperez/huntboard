import type { SubmitFunction } from '$app/forms';
import { needsRetry } from '#lib/components/admin/admin-message.js';
import { FormAction, type Recheck } from '#lib/components/form-action.svelte.js';
import { toast } from '#lib/components/toast/index.js';
import type { GameClock } from '#lib/client/game-clock.svelte.js';
import { actionFailureMessage } from './action-message.js';

/**
 * Busy and error state of a team sheet's forms, and the enhance callback they share. The clock
 * words the closed window message, because only the browser knows the viewer's time zone.
 */
export class TeamAction extends FormAction {
	readonly #clock: () => GameClock;

	/** subject is what the form acts on. */
	constructor(clock: () => GameClock, subject?: () => unknown) {
		super(subject);
		this.#clock = clock;
	}

	/** Shows an error found before sending, like a picture the browser cannot read. */
	fail(message: string) {
		this.recordFailure(message);
	}

	/**
	 * On success, runs onsuccess with the sent form and shows `done` as a toast. tookEffect tells
	 * whether a request that lost its answer went through after all.
	 */
	submit(
		done: string,
		onsuccess: (formData: FormData) => void,
		tookEffect?: Recheck<boolean>
	): SubmitFunction {
		return ({ formData }) => {
			this.start();
			const check = tookEffect?.(formData);
			return async ({ result }) => {
				const current = await this.refresh();
				this.busy = false;
				const landed = needsRetry(result) && current && check?.() === true;
				const message = landed
					? null
					: actionFailureMessage(result, this.#clock().closedMessageFor);
				if (message) {
					this.recordFailure(message);
					return;
				}
				onsuccess(formData);
				toast.show(done);
			};
		};
	}
}
