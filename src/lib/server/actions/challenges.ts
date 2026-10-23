import {
	editChallenge,
	importChallenges,
	previewChallengeImport
} from '#lib/server/challenge-setup.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "challenges" so they cannot collide with other sections. */
export const challengesActions = {
	challengesPreview: adminAction('challenges', previewChallengeImport),
	challengesImport: adminAction('challenges', importChallenges),
	challengesEdit: adminAction('challenges', editChallenge)
} satisfies AdminActions;
