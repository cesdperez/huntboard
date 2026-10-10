import type { SubmitFunction } from '$app/forms';
import { invalidate } from '$app/navigation';
import { toast } from '#lib/components/toast/index.js';
import { GAME_DATA } from '#lib/live-updates.js';
import { actionFailureMessage } from './action-message.js';
import type { GameClock } from '#lib/game-clock.svelte.js';

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

	/** On success, runs onsuccess with the sent form and shows `done` as a toast. */
	submit(done: string, onsuccess: (formData: FormData) => void): SubmitFunction {
		return ({ formData }) => {
			this.busy = true;
			this.#failure = null;
			return async ({ result }) => {
				// Refresh either way: a failure usually means someone else changed this claim.
				await invalidate(GAME_DATA).catch(() => {});
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
