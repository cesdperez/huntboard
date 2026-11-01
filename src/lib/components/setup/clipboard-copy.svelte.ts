const COPIED_MS = 2000;

/** Copies text and says how it went: "copied" for two seconds, or "blocked" until the next try. */
export class ClipboardCopy {
	state = $state<'idle' | 'copied' | 'blocked'>('idle');
	#resetTimer: ReturnType<typeof setTimeout> | undefined;

	async copy(text: string): Promise<boolean> {
		clearTimeout(this.#resetTimer);
		try {
			await navigator.clipboard.writeText(text);
			this.state = 'copied';
			this.#resetTimer = setTimeout(() => (this.state = 'idle'), COPIED_MS);
			return true;
		} catch {
			this.state = 'blocked';
			return false;
		}
	}
}
