import { normalizeName } from './name.js';
import { collapseSpaces } from '../format/text.js';

/** Shared by the admin setup and the team's own rename, so both agree on what a team name is. */
export const TEAM_NAME_MAX_LENGTH = 40;

export const normalizeTeamName = (value: unknown) => normalizeName(value, TEAM_NAME_MAX_LENGTH);

export const TEAM_NAME_TAKEN_ERROR = 'Another team already has this name. Choose another one.';

/** Two names with the same key belong to one team at most, within a game. */
export const teamNameKey = (name: string) => collapseSpaces(name).toLowerCase();

/** Why normalizeTeamName refused a name: missing or too long. */
export function teamNameError(value: unknown): string {
	return typeof value === 'string' && collapseSpaces(value)
		? `Keep the team name to at most ${TEAM_NAME_MAX_LENGTH} characters.`
		: 'Give the team a name.';
}

export const TEAM_MEMBERS_MAX_LENGTH = 80;

export const TEAM_MEMBERS_ERROR = `Keep the team members to at most ${TEAM_MEMBERS_MAX_LENGTH} characters.`;

/** Members are optional: blank input becomes an empty string, and null means too long. */
export function normalizeTeamMembers(value: unknown): string | null {
	if (typeof value !== 'string') return '';
	const members = collapseSpaces(value);
	return members.length > TEAM_MEMBERS_MAX_LENGTH ? null : members;
}
