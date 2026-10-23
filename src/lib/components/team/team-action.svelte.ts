import type { SubmitFunction } from '$app/forms';
import { FormAction } from '#lib/components/form-action.svelte.js';
import { toast } from '#lib/components/toast/index.js';
import type { GameClock } from '#lib/game-clock.svelte.js';
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

	/** On success, runs onsuccess with the sent form and shows `done` as a toast. */
	submit(done: string, onsuccess: (formData: FormData) => void): SubmitFunction {
		return ({ formData }) => {
			this.start();
			return async ({ result }) => {
				await this.refresh();
				const message = actionFailureMessage(result, this.#clock().closedMessageFor);
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
