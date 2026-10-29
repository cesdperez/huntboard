const VISIBLE_MS = 3000;

/** One short message at a time. Only shown from the browser, so it stays empty on the server. */
class ToastStore {
	message = $state<string | null>(null);
	/** Changes on every show, so the same message twice in a row is announced twice. */
	id = $state(0);
	#waiting: string[] = [];
	#showingQueued = false;
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** Shows a confirmation at once, in place of the message showing. */
	show(message: string) {
		// A queued message tells something the user did not do, so it shows again after this one.
		if (this.#showingQueued && this.message !== null) this.#waiting.unshift(this.message);
		this.#display(message, false);
	}

	/** Shows each message in turn, once the message showing has had its time. */
	queue(...messages: string[]) {
		this.#waiting.push(...messages);
		if (this.message === null) this.#next();
	}

	#display(message: string, queued: boolean) {
		clearTimeout(this.#timer);
		this.message = message;
		this.#showingQueued = queued;
		this.id++;
		this.#timer = setTimeout(() => this.#next(), VISIBLE_MS);
	}

	#next() {
		const message = this.#waiting.shift();
		if (message === undefined) {
			this.message = null;
			this.#showingQueued = false;
			return;
		}
		this.#display(message, true);
	}
}

export const toast = new ToastStore();
