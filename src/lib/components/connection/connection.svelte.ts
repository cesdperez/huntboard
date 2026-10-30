import { invalidate } from '$app/navigation';
import { isReachable, refreshIfReachable, refreshKeepingPage } from '#lib/client/connection.js';
import { GAME_DATA } from '#lib/domain/game-data.js';

/** Only set in the browser, so on the server the page reads as online and up to date. */
class Connection {
	/** Whether the last check reached the server. */
	online = $state(true);
	/** Whether the last refresh reached the server but failed there, so the page shows older data. */
	stale = $state(false);
}

export const connection = new Connection();

const report = (online: boolean) => (connection.online = online);

/**
 * Refreshes the live game data on this page. Out of reach or failing, the page keeps what it shows
 * and a notice says so.
 */
export function refreshGameData(): Promise<void> {
	return refreshIfReachable(async () => {
		connection.stale = !(await refreshKeepingPage(() => invalidate(GAME_DATA)));
	}, report);
}

/** Updates the offline state without loading anything. */
export async function checkConnection(): Promise<void> {
	report(await isReachable());
}

/** Loads the current page again, for the error page to recover once the connection is back. */
export function retryPage(reload: () => Promise<void>): Promise<void> {
	return refreshIfReachable(reload, report);
}
