import { invalidate } from '$app/navigation';
import { isReachable, refreshIfReachable } from '#lib/connection.js';
import { GAME_DATA } from '#lib/live-updates.js';

/** Whether the last check reached the server. Only set in the browser, so it stays true on the server. */
class Connection {
	online = $state(true);
}

export const connection = new Connection();

const report = (online: boolean) => (connection.online = online);

/** Refreshes the live game data on this page, or shows the offline notice when out of reach. */
export function refreshGameData(): Promise<void> {
	return refreshIfReachable(() => invalidate(GAME_DATA), report);
}

/** Updates the offline state without loading anything. */
export async function checkConnection(): Promise<void> {
	report(await isReachable());
}

/** Loads the current page again, for the error page to recover once the connection is back. */
export function retryPage(reload: () => Promise<void>): Promise<void> {
	return refreshIfReachable(reload, report);
}
