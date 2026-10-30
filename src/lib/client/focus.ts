/**
 * Focuses target when the control that had focus left the page, which drops focus to the page
 * top. Focus the user moved elsewhere in the meantime stays where it is.
 */
export function focusIfLost(target: HTMLElement | null | undefined): void {
	const active = document.activeElement;
	if (active === null || active === document.body) target?.focus();
}
