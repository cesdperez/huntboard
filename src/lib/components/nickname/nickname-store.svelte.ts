import { normalizeNickname } from '#lib/domain/nickname.js';

const STORAGE_KEY = 'huntboard.nickname';

/**
 * The viewer's nickname, kept in localStorage. It is only ever loaded and set in the browser:
 * module state on the server is shared across requests, so it must stay null there.
 */
class NicknameStore {
	value = $state<string | null>(null);
	loaded = $state(false);
	editing = $state(false);
	/** The nickname button on this page, where focus goes after the first prompt. */
	button = $state<HTMLElement | null>(null);

	readonly promptOpen = $derived(this.loaded && (this.value === null || this.editing));

	load() {
		try {
			this.value = normalizeNickname(localStorage.getItem(STORAGE_KEY));
		} catch {
			this.value = null;
		}
		this.loaded = true;
	}

	/** Returns false when the name is not a valid nickname, leaving the stored one unchanged. */
	save(name: string): boolean {
		const nickname = normalizeNickname(name);
		if (!nickname) return false;
		this.value = nickname;
		this.editing = false;
		try {
			localStorage.setItem(STORAGE_KEY, nickname);
		} catch {
			// Private mode or blocked storage: keep it for this page view only.
		}
		return true;
	}
}

export const nickname = new NicknameStore();
