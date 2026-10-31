import { env } from 'cloudflare:workers';
import { challengesActions } from '#lib/server/actions/challenges.js';
import { claimGameActions } from '#lib/server/actions/claim-game.js';
import { gameImageActions } from '#lib/server/actions/game-image.js';
import { gameSettingsActions } from '#lib/server/actions/game-settings.js';
import { mediaActions } from '#lib/server/actions/media.js';
import { teamsActions } from '#lib/server/actions/teams.js';
import { listChallengesWithClaimCounts } from '#lib/server/db/challenges.js';
import { countGameMedia } from '#lib/server/db/claim-media.js';
import { listSetupTeams } from '#lib/server/db/teams.js';
import { getSignedInUser } from '#lib/server/http/session.js';
import { getClaimSection } from '#lib/server/pages/claim-section.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { game } = await event.parent();
	const [teams, challenges, mediaCount, claim] = await Promise.all([
		listSetupTeams(env.DB, game.id),
		listChallengesWithClaimCounts(env.DB, game.id),
		countGameMedia(env.DB, game.id),
		getClaimSection(game, () => getSignedInUser(event))
	]);
	return { teams, challenges, mediaCount, claim } as const;
};

export const actions = {
	...gameSettingsActions,
	...gameImageActions,
	...teamsActions,
	...challengesActions,
	...claimGameActions,
	...mediaActions
} satisfies Actions;
