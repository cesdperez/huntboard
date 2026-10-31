import { resolve } from '$app/paths';
import { absoluteLink } from './absolute-link.js';

/** The full links a game hands out, as seen from the page at `pageHref`. */
export function gameLinks(pageHref: string) {
	const absolute = (path: string) => absoluteLink(path, pageHref);
	return {
		admin: (token: string) => absolute(resolve('/a/[token]', { token })),
		scoreboard: (token: string) => absolute(resolve('/s/[token]', { token })),
		team: (token: string) => absolute(resolve('/t/[token]', { token })),
		/** Read out loud and printed, so it drops the https:// a player would never type. */
		joinPage: absolute(resolve('/join')).replace(/^https?:\/\//, '')
	};
}
