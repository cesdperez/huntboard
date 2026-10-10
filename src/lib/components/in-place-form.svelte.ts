import { tick } from 'svelte';

/**
 * A form shown in place of the button that opens it. Focus moves to the form when it opens and
 * back to that button when it closes, so it never falls back to the top of the page. Give the
 * form tabindex="-1" and a label. Focus lands on the form, not its first field, so the phone
 * keyboard opens only when the user taps a field.
 */
export class InPlaceForm {
	open = $state(false);
	opener = $state<HTMLElement | null>(null);
	form = $state<HTMLElement | null>(null);

	show = () => this.#set(true);
	hide = () => this.#set(false);

	async #set(open: boolean) {
		this.open = open;
		await tick();
		(open ? this.form : this.opener)?.focus();
	}
}
