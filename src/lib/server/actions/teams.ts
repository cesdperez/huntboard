import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import {
	TEAM_MEMBERS_ERROR,
	TEAM_NAME_ERROR,
	normalizeTeamMembers,
	normalizeTeamName
} from '#lib/team-name.js';
import { requireAdminGame } from '#lib/server/admin-game.js';
import { addTeam, deleteTeam, moveTeam, updateTeam } from '#lib/server/db/teams.js';
import { readId, readString } from '#lib/server/form.js';
import type { AdminAction, AdminActions } from './types.js';

/** What the teams actions return under `page.form.teams`. Errors without a teamId belong to the add form. */
export interface TeamsFormResult {
	error?: string;
	teamId?: number;
	name?: string;
	members?: string;
}

const MISSING_ERROR = 'That team is not in this game any more. Reload the page.';

function teamsFail(status: number, result: TeamsFormResult) {
	return fail(status, { teams: result });
}

function move(offset: -1 | 1): AdminAction {
	return async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const teamId = readId(await request.formData(), 'teamId');
		if (teamId === null) return teamsFail(400, { error: MISSING_ERROR });
		// Already at the end is a no-op, not an error: the button is disabled there anyway.
		await moveTeam(env.DB, game.id, teamId, offset);
		return { teams: { teamId } satisfies TeamsFormResult };
	};
}

/** Setup tab actions. Names start with "teams" so they cannot collide with other sections. */
export const teamsActions = {
	teamsAdd: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		const typed = { name: readString(data, 'name'), members: readString(data, 'members') };
		const name = normalizeTeamName(data.get('name'));
		if (!name) return teamsFail(400, { error: TEAM_NAME_ERROR, ...typed });
		const members = normalizeTeamMembers(data.get('members'));
		if (members === null) return teamsFail(400, { error: TEAM_MEMBERS_ERROR, ...typed });

		const team = await addTeam(env.DB, game.id, name, members);
		return { teams: { teamId: team.id } satisfies TeamsFormResult };
	},

	teamsRename: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const data = await request.formData();
		const teamId = readId(data, 'teamId');
		if (teamId === null) return teamsFail(400, { error: MISSING_ERROR });
		const typed = { teamId, name: readString(data, 'name'), members: readString(data, 'members') };
		const name = normalizeTeamName(data.get('name'));
		if (!name) return teamsFail(400, { error: TEAM_NAME_ERROR, ...typed });
		const members = normalizeTeamMembers(data.get('members'));
		if (members === null) return teamsFail(400, { error: TEAM_MEMBERS_ERROR, ...typed });

		if (!(await updateTeam(env.DB, game.id, teamId, { name, members }))) {
			return teamsFail(404, { error: MISSING_ERROR, teamId });
		}
		return { teams: { teamId } satisfies TeamsFormResult };
	},

	teamsMoveUp: move(-1),
	teamsMoveDown: move(1),

	teamsDelete: async ({ params, request }) => {
		const game = await requireAdminGame(params.token);
		const teamId = readId(await request.formData(), 'teamId');
		if (teamId === null) return teamsFail(400, { error: MISSING_ERROR });

		const result = await deleteTeam(env.DB, game.id, teamId);
		if (result === 'has-claims') {
			return teamsFail(409, {
				error: 'This team has claims, so it cannot be deleted. Rename it instead.',
				teamId
			});
		}
		if (result === 'not-found') return teamsFail(404, { error: MISSING_ERROR, teamId });
		return { teams: {} satisfies TeamsFormResult };
	}
} satisfies AdminActions;
