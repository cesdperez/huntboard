import { env } from 'cloudflare:workers';
import {
	createTeam,
	editTeam,
	moveTeamDown,
	moveTeamUp,
	removeTeam,
	removeTeamPicture
} from '#lib/server/team-setup.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "teams" so they cannot collide with other sections. */
export const teamsActions = {
	teamsAdd: adminAction('teams', createTeam),
	teamsRename: adminAction('teams', editTeam),
	teamsMoveUp: adminAction('teams', moveTeamUp),
	teamsMoveDown: adminAction('teams', moveTeamDown),
	teamsDelete: adminAction('teams', (db, gameId, data) => removeTeam(db, env.IMAGES, gameId, data)),
	teamsAvatarRemove: adminAction('teams', (db, gameId, data) =>
		removeTeamPicture(db, env.IMAGES, gameId, data)
	)
} satisfies AdminActions;
