import type { SubmitFunction } from '$app/forms';
import { refreshGameData } from '#lib/components/connection/index.js';
import { toast } from '#lib/components/toast/index.js';
import type { GameClock } from '#lib/game-clock.svelte.js';
import { actionFailureMessage } from './action-message.js';

/** Busy and error state of a team sheet's forms, and the enhance callback they share. */
export class TeamAction {
	busy = $state(false);
	#failure = $state<{ message: string; subject: unknown } | null>(null);
	readonly #clock: () => GameClock;
	readonly #subject: () => unknown;

	/** subject is what the form acts on. An error hides once a poll changes it, so it never describes a stale state. */
	constructor(clock: () => GameClock, subject: () => unknown = () => null) {
		this.#clock = clock;
		this.#subject = subject;
	}

	get error(): string | null {
		const failure = this.#failure;
		return failure && failure.subject === this.#subject() ? failure.message : null;
	}

	clearError() {
		this.#failure = null;
	}

	/** Shows an error found before sending, like a picture the browser cannot read. */
	fail(message: string) {
		this.#failure = { message, subject: this.#subject() };
	}

	/** On success, runs onsuccess with the sent form and shows `done` as a toast. */
	submit(done: string, onsuccess: (formData: FormData) => void): SubmitFunction {
		return ({ formData }) => {
			this.busy = true;
			this.#failure = null;
			return async ({ result }) => {
				// Refresh either way: a failure usually means someone else changed this claim.
				await refreshGameData().catch(() => {});
				this.busy = false;
				const message = actionFailureMessage(result, this.#clock().closedMessageFor);
				if (message) {
					this.#failure = { message, subject: this.#subject() };
					return;
				}
				onsuccess(formData);
				toast.show(done);
			};
		};
	}
}
