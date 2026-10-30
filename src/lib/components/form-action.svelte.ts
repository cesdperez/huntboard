import { connection, refreshGameData } from '#lib/components/connection/index.js';

interface Failure<R> {
	message: string | null;
	result: R | undefined;
	subject: unknown;
}

/**
 * Called as a request leaves, with its form, so it can note the state the request started from.
 * The function it returns runs after a request that lost its answer, once the page shows the
 * server's state again, and tells from that state what the request did.
 */
export type Recheck<T> = (formData: FormData) => () => T;

/**
 * Busy and error state of a form that changes game data. An error belongs to the subject the form
 * acted on and hides once a poll changes that subject, so it never describes a stale state.
 */
export class FormAction<R = never> {
	busy = $state(false);
	#failure = $state<Failure<R> | null>(null);
	readonly #subject: () => unknown;

	constructor(subject: () => unknown = () => null) {
		this.#subject = subject;
	}

	get error(): string | null {
		return this.#current()?.message ?? null;
	}

	/** The failed result, for forms that show errors field by field. */
	get failed(): R | undefined {
		return this.#current()?.result;
	}

	clearError() {
		this.#failure = null;
	}

	protected start() {
		this.busy = true;
		this.#failure = null;
	}

	/**
	 * Refresh either way: a failure usually means someone else changed the same thing. Resolves
	 * whether the page now shows the server's state, so a lost answer can be judged from it.
	 */
	protected async refresh(): Promise<boolean> {
		await refreshGameData().catch(() => {});
		return connection.online && !connection.stale;
	}

	protected recordFailure(
		message: string | null,
		result: R | undefined = undefined,
		subject: unknown = this.#subject()
	) {
		this.#failure = { message, result, subject };
	}

	protected currentSubject(): unknown {
		return this.#subject();
	}

	#current(): Failure<R> | null {
		const failure = this.#failure;
		return failure && failure.subject === this.#subject() ? failure : null;
	}
}
