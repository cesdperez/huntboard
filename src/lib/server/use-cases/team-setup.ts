import {
	TEAM_MEMBERS_ERROR,
	TEAM_NAME_TAKEN_ERROR,
	normalizeTeamMembers,
	normalizeTeamName,
	teamNameError
} from '#lib/domain/team-name.js';
import type { ActionOutcome } from './action-outcome.js';
import { addTeam, moveTeam, updateTeam } from '../db/teams.js';
import { readId, readString } from './form.js';
import type { ImageBucket } from '../storage/image-store.js';
import { deleteTeamWithAvatar, removeTeamAvatar } from './images.js';

/** What the teams actions return under `page.form.teams`. Errors without a teamId belong to the add form. */
export interface TeamsFormResult {
	error?: string;
	teamId?: number;
	name?: string;
	members?: string;
}

type TeamsOutcome = ActionOutcome<TeamsFormResult>;

const MISSING_ERROR = 'That team is not in this game any more. Reload the page.';

export async function createTeam(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamsOutcome> {
	const typed = { name: readString(data, 'name'), members: readString(data, 'members') };
	const team = readTeam(data);
	if ('error' in team) return failure(400, { error: team.error, ...typed });

	const added = await addTeam(db, gameId, team.name, team.members);
	if (added.status === 'name-taken')
		return failure(409, { error: TEAM_NAME_TAKEN_ERROR, ...typed });
	return success({ teamId: added.team.id });
}

export async function editTeam(
	db: D1Database,
	gameId: number,
	data: FormData
): Promise<TeamsOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return failure(400, { error: MISSING_ERROR });
	const typed = { teamId, name: readString(data, 'name'), members: readString(data, 'members') };
	const team = readTeam(data);
	if ('error' in team) return failure(400, { error: team.error, ...typed });

	switch (await updateTeam(db, gameId, teamId, team)) {
		case 'not-found':
			return failure(404, { error: MISSING_ERROR, teamId });
		case 'name-taken':
			return failure(409, { error: TEAM_NAME_TAKEN_ERROR, ...typed });
		case 'updated':
			return success({ teamId });
	}
}

export const moveTeamUp = moveBy(-1);
export const moveTeamDown = moveBy(1);

export async function removeTeam(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number,
	data: FormData
): Promise<TeamsOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return failure(400, { error: MISSING_ERROR });

	switch (await deleteTeamWithAvatar(db, bucket, gameId, teamId)) {
		case 'has-claims':
			return failure(409, {
				error: 'This team has claims, so it cannot be deleted. Rename it instead.',
				teamId
			});
		case 'not-found':
			return failure(404, { error: MISSING_ERROR, teamId });
		case 'deleted':
			return success({});
	}
}

export async function removeTeamPicture(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number,
	data: FormData
): Promise<TeamsOutcome> {
	const teamId = readId(data, 'teamId');
	if (teamId === null) return failure(400, { error: MISSING_ERROR });

	if (!(await removeTeamAvatar(db, bucket, gameId, teamId))) {
		return failure(404, { error: MISSING_ERROR, teamId });
	}
	return success({ teamId });
}

function moveBy(offset: -1 | 1) {
	return async (db: D1Database, gameId: number, data: FormData): Promise<TeamsOutcome> => {
		const teamId = readId(data, 'teamId');
		if (teamId === null) return failure(400, { error: MISSING_ERROR });
		// Already at the end is a no-op, not an error: the button is disabled there anyway.
		await moveTeam(db, gameId, teamId, offset);
		return success({ teamId });
	};
}

function readTeam(data: FormData): { name: string; members: string } | { error: string } {
	const name = normalizeTeamName(data.get('name'));
	if (!name) return { error: teamNameError(data.get('name')) };
	const members = normalizeTeamMembers(data.get('members'));
	if (members === null) return { error: TEAM_MEMBERS_ERROR };
	return { name, members };
}

function success(result: TeamsFormResult): TeamsOutcome {
	return { status: 200, result };
}

function failure(status: number, result: TeamsFormResult): TeamsOutcome {
	return { status, result };
}
