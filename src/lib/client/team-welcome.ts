type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

const key = (teamToken: string) => `huntboard.team-welcome-dismissed.${teamToken}`;

function browserStorage(): BrowserStorage | null {
	try {
		return localStorage;
	} catch {
		return null;
	}
}

export function teamWelcomeDismissed(teamToken: string, storage = browserStorage()): boolean {
	try {
		return storage?.getItem(key(teamToken)) !== null;
	} catch {
		// Blocked storage could never keep the dismissal, so the card would return on every load.
		return true;
	}
}

export function dismissTeamWelcome(teamToken: string, storage = browserStorage()): void {
	try {
		storage?.setItem(key(teamToken), '1');
	} catch {
		// Storage full or refused: the card stays hidden until the page reloads.
	}
}
