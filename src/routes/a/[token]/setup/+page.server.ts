import { env } from 'cloudflare:workers';
import { challengesActions } from '#lib/server/actions/challenges.js';
import { gameSettingsActions } from '#lib/server/actions/game-settings.js';
import { linksActions } from '#lib/server/actions/links.js';
import { teamsActions } from '#lib/server/actions/teams.js';
import { listChallengesWithClaimCounts } from '#lib/server/db/challenges.js';
import { listTeamsWithClaimCounts } from '#lib/server/db/teams.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { game } = await parent();
	const [teams, challenges] = await Promise.all([
		listTeamsWithClaimCounts(env.DB, game.id),
		listChallengesWithClaimCounts(env.DB, game.id)
	]);
	return { teams, challenges };
};

export const actions = {
	...gameSettingsActions,
	...teamsActions,
	...challengesActions,
	...linksActions
} satisfies Actions;
