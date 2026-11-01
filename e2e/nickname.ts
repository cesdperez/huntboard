import type { BrowserContext } from '@playwright/test';
import { teamWelcomeKey } from '../src/lib/client/team-welcome.js';

/** Gives every page of the context this nickname, as a player who already started on every team link. */
export async function rememberNickname(context: BrowserContext, nickname: string): Promise<void> {
	await context.addInitScript(
		([name, welcomeKeyPrefix]) => {
			localStorage.setItem('huntboard.nickname', name);
			const team = /^\/t\/([^/]+)/.exec(location.pathname);
			if (team) localStorage.setItem(welcomeKeyPrefix + team[1], '1');
		},
		[nickname, teamWelcomeKey('')] as const
	);
}
