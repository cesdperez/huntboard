import { validateChallengeEdit } from '#lib/domain/challenge-edit.js';
import { parseChallenges } from '#lib/domain/challenge-parser.js';
import { normalizeTeamMembers, normalizeTeamName, teamNameKey } from '#lib/domain/team-name.js';
import { collapseSpaces } from '#lib/format/text.js';
import type { ChallengeRow, GameRow, TeamRow } from '#lib/server/db/types.js';

// What each Setup action leaves on the refreshed page, read the way its use case reads the form,
// so a request that lost its answer can tell whether it went through.

function sent(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

const sentId = (data: FormData) => Number(sent(data, 'teamId'));

export function gameSettingsSaved(game: GameRow, data: FormData): boolean {
	const timeSaved = (key: 'starts_at' | 'ends_at') =>
		!data.has(key) || (game[key] ?? '') === sent(data, key);
	return (
		game.name === sent(data, 'name') &&
		game.late_penalty_per_minute === Number(sent(data, 'late_penalty_per_minute')) &&
		timeSaved('starts_at') &&
		timeSaved('ends_at') &&
		(!data.has('theme') || game.theme === data.get('theme'))
	);
}

export function gameImageSaved(before: GameRow, after: GameRow, data: FormData): boolean {
	const image = data.get('image');
	const newImage = image instanceof File && image.size > 0;
	return (
		after.image_label === collapseSpaces(sent(data, 'label')) &&
		(!newImage || after.image_key !== before.image_key)
	);
}

/** Whether the game is as /new makes it and a reset leaves it: no teams, challenges, times or image. */
export function gameIsBlank(game: GameRow, teamCount: number, challengeCount: number): boolean {
	return (
		teamCount === 0 &&
		challengeCount === 0 &&
		game.starts_at === null &&
		game.ends_at === null &&
		game.late_penalty_per_minute === 0 &&
		game.image_key === null
	);
}

export function teamAdded(before: TeamRow[], after: TeamRow[], data: FormData): boolean {
	const key = teamNameKey(normalizeTeamName(data.get('name')) ?? '');
	const members = normalizeTeamMembers(data.get('members'));
	return (
		!before.some((team) => team.name_key === key) &&
		after.some((team) => team.name_key === key && team.members === members)
	);
}

export function teamSaved(teams: TeamRow[], data: FormData): boolean {
	const team = teams.find((team) => team.id === sentId(data));
	return (
		team?.name === normalizeTeamName(data.get('name')) &&
		team.members === normalizeTeamMembers(data.get('members'))
	);
}

export function teamDeleted(teams: TeamRow[], data: FormData): boolean {
	return !teams.some((team) => team.id === sentId(data));
}

export function teamPictureRemoved(teams: TeamRow[], data: FormData): boolean {
	return teams.find((team) => team.id === sentId(data))?.avatar_key === null;
}

export function teamMoved(
	before: TeamRow[],
	after: TeamRow[],
	data: FormData,
	offset: -1 | 1
): boolean {
	const index = (teams: TeamRow[]) => teams.findIndex((team) => team.id === sentId(data));
	return index(before) >= 0 && index(after) === index(before) + offset;
}

export function challengeSaved(challenges: ChallengeRow[], data: FormData): boolean {
	const validated = validateChallengeEdit({
		title: sent(data, 'title'),
		description: sent(data, 'description'),
		section: sent(data, 'section'),
		min: sent(data, 'min'),
		max: sent(data, 'max')
	});
	const challenge = challenges.find((challenge) => challenge.id === Number(sent(data, 'id')));
	return validated.ok && challenge !== undefined && sameChallenge(challenge, validated.fields);
}

export function challengesImported(challenges: ChallengeRow[], data: FormData): boolean {
	const text = data.get('text');
	const imported = parseChallenges(typeof text === 'string' ? text : '').challenges;
	return (
		imported.length === challenges.length &&
		imported.every((fields, index) => sameChallenge(challenges[index], fields))
	);
}

type ChallengeContent = Pick<
	ChallengeRow,
	'title' | 'description' | 'section' | 'min_points' | 'max_points'
>;

function sameChallenge(challenge: ChallengeContent, fields: ChallengeContent): boolean {
	return (
		challenge.title === fields.title &&
		challenge.description === fields.description &&
		challenge.section === fields.section &&
		challenge.min_points === fields.min_points &&
		challenge.max_points === fields.max_points
	);
}
