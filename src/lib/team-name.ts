import { normalizeName } from './name.js';

/** Shared by the admin setup and the team's own rename, so both agree on what a team name is. */
export const TEAM_NAME_MAX_LENGTH = 40;

export const TEAM_NAME_ERROR = `Give the team a name of at most ${TEAM_NAME_MAX_LENGTH} characters.`;

export const normalizeTeamName = (value: unknown) => normalizeName(value, TEAM_NAME_MAX_LENGTH);
