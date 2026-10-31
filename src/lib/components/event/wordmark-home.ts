import { resolve } from '$app/paths';

export interface WordmarkContext {
	routeId: string | null;
	params: Partial<Record<string, string>>;
	signedIn: boolean;
	error: boolean;
}

/**
 * Where the app bar wordmark leads: the home of the visitor's role in the game, so a player or a
 * spectator never lands on the landing page. Pages outside a game, and error pages, lead home.
 */
export function wordmarkHome({ routeId, params, signedIn, error }: WordmarkContext) {
	const token = params.token;
	// The link that failed may be the one this page is on.
	if (error || !token) return resolve('/');
	if (inRoute(routeId, '/t/[token]')) return resolve('/t/[token]', { token });
	if (inRoute(routeId, '/s/[token]')) return resolve('/s/[token]', { token });
	if (inRoute(routeId, '/a/[token]')) {
		return signedIn ? resolve('/games') : resolve('/a/[token]', { token });
	}
	return resolve('/');
}

function inRoute(routeId: string | null, base: string) {
	return routeId === base || routeId?.startsWith(`${base}/`) === true;
}
