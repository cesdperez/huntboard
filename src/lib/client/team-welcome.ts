import { browserStorage } from './browser-storage.js';

/** The localStorage key that remembers a team link's welcome screen was dismissed. */
export const teamWelcomeKey = (teamToken: string) =>
	`huntboard.team-welcome-dismissed.${teamToken}`;

export function teamWelcomeDismissed(teamToken: string, storage = browserStorage()): boolean {
	try {
		return storage?.getItem(teamWelcomeKey(teamToken)) !== null;
	} catch {
		// Blocked storage could never keep the dismissal, so the welcome screen would return on every load.
		return true;
	}
}

export function dismissTeamWelcome(teamToken: string, storage = browserStorage()): void {
	try {
		storage?.setItem(teamWelcomeKey(teamToken), '1');
	} catch {
		// Storage full or refused: the welcome screen stays hidden until the page reloads.
	}
}
