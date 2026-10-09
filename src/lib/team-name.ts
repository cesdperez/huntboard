/** Shared by the admin setup and the team's own rename, so both agree on what a team name is. */
export const TEAM_NAME_MAX_LENGTH = 40;

/** Trimmed team name, or null when it is empty or too long. */
export function normalizeTeamName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().replace(/\s+/g, ' ');
	if (!trimmed || trimmed.length > TEAM_NAME_MAX_LENGTH) return null;
	return trimmed;
}
