import { recordRecentGame, type RecentGameLink } from './recent-games.js';

/**
 * Records the page's link in the recent games list, and again when its names change. Call it
 * while a component initialises, so it runs only in the browser.
 */
export function trackRecentGame(link: () => RecentGameLink): void {
	let recorded: RecentGameLink | undefined;
	$effect(() => {
		const next = link();
		if (recorded && sameLink(recorded, next)) return;
		// Rotating the admin link moves the layout to the new path without remounting it.
		recordRecentGame(next, { replaces: recorded?.path });
		recorded = next;
	});
}

function sameLink(a: RecentGameLink, b: RecentGameLink): boolean {
	return (
		a.kind === b.kind && a.path === b.path && a.gameName === b.gameName && a.teamName === b.teamName
	);
}
