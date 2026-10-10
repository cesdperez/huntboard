const VISIBLE_MS = 3000;

/** One short confirmation at a time. Only shown from event handlers, so it stays empty on the server. */
class ToastStore {
	message = $state<string | null>(null);
	/** Changes on every show, so the same message twice in a row is announced twice. */
	id = $state(0);
	#timer: ReturnType<typeof setTimeout> | undefined;

	show(message: string) {
		clearTimeout(this.#timer);
		this.message = message;
		this.id++;
		this.#timer = setTimeout(() => (this.message = null), VISIBLE_MS);
	}
}

export const toast = new ToastStore();
