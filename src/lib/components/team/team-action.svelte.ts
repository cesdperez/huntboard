import type { SubmitFunction } from '$app/forms';
import { invalidate } from '$app/navigation';
import { toast } from '#lib/components/toast/index.js';
import { GAME_DATA } from '#lib/live-updates.js';
import { actionFailureMessage } from './action-message.js';
import type { GameClock } from './game-clock.svelte.js';

/** Busy and error state of a team sheet's forms, and the enhance callback they share. */
export class TeamAction {
	busy = $state(false);
	error = $state<string | null>(null);
	readonly #clock: () => GameClock;

	constructor(clock: () => GameClock) {
		this.#clock = clock;
	}

	/** On success, runs onsuccess with the sent form and shows `done` as a toast. */
	submit(done: string, onsuccess: (formData: FormData) => void): SubmitFunction {
		return ({ formData }) => {
			this.busy = true;
			this.error = null;
			return async ({ result }) => {
				// Refresh either way: a failure usually means someone else changed this claim.
				await invalidate(GAME_DATA).catch(() => {});
				this.busy = false;
				this.error = actionFailureMessage(result, this.#clock().closedMessageFor);
				if (this.error) return;
				onsuccess(formData);
				toast.show(done);
			};
		};
	}
}
