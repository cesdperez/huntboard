import { env } from 'cloudflare:workers';
import {
	editChallenge,
	importChallenges,
	previewChallengeImport
} from '#lib/server/use-cases/challenge-setup.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "challenges" so they cannot collide with other sections. */
export const challengesActions = {
	challengesPreview: adminAction('challenges', previewChallengeImport),
	challengesImport: adminAction('challenges', (db, gameId, data) =>
		importChallenges(db, env.MEDIA, gameId, data)
	),
	challengesEdit: adminAction('challenges', editChallenge)
} satisfies AdminActions;
