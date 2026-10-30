import {
	checkRotation,
	forgetNewAdminToken,
	newAdminToken,
	rememberNewAdminToken,
	type Rotation
} from '#lib/client/new-admin-link.js';
import { generateToken } from '#lib/domain/token.js';

/**
 * The admin token a rotate sent, kept in the tab until its link is known to work. When the answer
 * is lost and neither link answers, it stays unsure, so the page can keep offering the new link.
 */
export class AdminLinkRotation {
	pending = $state<string | null>(null);
	unsure = $state(false);
	readonly #current: () => string;
	readonly #opens: (token: string) => Promise<boolean>;
	readonly #moveTo: (token: string) => Promise<void>;

	/** current is the admin token of this page. moveTo goes to the link of a token that works. */
	constructor(
		current: () => string,
		opens: (token: string) => Promise<boolean>,
		moveTo: (token: string) => Promise<void>
	) {
		this.#current = current;
		this.#opens = opens;
		this.#moveTo = moveTo;
	}

	/** Picks up a token this tab sent from this link without learning what became of it. */
	async restore(): Promise<void> {
		this.pending = newAdminToken(this.#current());
		this.unsure = this.pending !== null;
		if (this.pending) await this.recheck();
	}

	/** The token to send. An unconfirmed one goes again, so the tab never has two new links. */
	begin(): string {
		const token = this.pending ?? generateToken();
		this.pending = token;
		rememberNewAdminToken(this.#current(), token);
		return token;
	}

	/** Checks both links and moves to the new one once it works. Kept means it never rotated. */
	async recheck(): Promise<Rotation> {
		const token = this.pending;
		if (!token) return 'kept';
		const rotation = await checkRotation(this.#current(), token, this.#opens);
		if (rotation === 'unknown') {
			this.unsure = true;
			return rotation;
		}
		this.clear();
		if (rotation === 'moved') await this.#moveTo(token);
		return rotation;
	}

	/** For an answer that settles it: the redirect to the new link, or a refusal. */
	clear(): void {
		forgetNewAdminToken(this.#current());
		this.pending = null;
		this.unsure = false;
	}
}
