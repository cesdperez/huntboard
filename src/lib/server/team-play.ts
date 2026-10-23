import { CLAIM_NOTE_MAX_LENGTH } from '#lib/claim-note.js';
import { DEAD_LINK_MESSAGE } from '#lib/dead-link.js';
import { gamePhase, type GamePhase } from '#lib/domain/game-window.js';
import { AVATAR_MAX_BYTES } from '#lib/images.js';
import { normalizeNickname } from '#lib/nickname.js';
import {
	TEAM_MEMBERS_ERROR,
	TEAM_NAME_ERROR,
	normalizeTeamMembers,
	normalizeTeamName
} from '#lib/team-name.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { markClaim, undoClaim } from './db/claims.js';
import { setTeamAvatar } from './db/images.js';
import { updateTeam } from './db/teams.js';
import { conflictMessage } from './conflict-message.js';
import { readId, readString } from './form.js';
import { replaceImage, type ImageBucket } from './image-store.js';
import { readImageUpload } from './image-upload.js';
import type { TeamLink } from './team-page.js';

/**
 * What a team action returns under `team`. A closed window carries only the phase,
 * because the message names a time and only the browser knows the viewer's time zone.
 */
export type TeamFormResult =
	| { kind: 'marked' }
	| { kind: 'undone' }
	| { kind: 'renamed' }
	| { kind: 'avatar-saved' }
	| { kind: 'closed'; phase: Exclude<GamePhase, 'during'> }
	| ErrorResult;

type TeamOutcome = ActionOutcome<TeamFormResult>;

const CHALLENGE_GONE = 'That challenge is not in this game any more.';

export async function markDone(
	db: D1Database,
	{ team, game }: TeamLink,
	data: FormData,
	now: Date
): Promise<TeamOutcome> {
	const closed = closedOutcome(game, now);
	if (closed) return closed;

	const markedBy = normalizeNickname(data.get('nickname'));
	if (!markedBy) return error(400, 'Set your nickname first, so the judge knows who marked this.');
	const note = readString(data, 'note');
	if (note.length > CLAIM_NOTE_MAX_LENGTH) {
		return error(400, `Keep the note to at most ${CLAIM_NOTE_MAX_LENGTH} characters.`);
	}
	const challengeId = readId(data, 'challengeId');
	if (challengeId === null) return error(404, CHALLENGE_GONE);

	const result = await markClaim(db, {
		gameId: game.id,
		teamId: team.id,
		challengeId,
		note: note || null,
		markedBy
	});
	switch (result.status) {
		case 'marked':
			return { status: 200, result: { kind: 'marked' } };
		case 'conflict':
			return error(409, conflictMessage(result.claim));
		case 'not-found':
			return error(404, CHALLENGE_GONE);
	}
}

export async function undoOwnClaim(
	db: D1Database,
	{ team, game }: TeamLink,
	data: FormData,
	now: Date
): Promise<TeamOutcome> {
	const closed = closedOutcome(game, now);
	if (closed) return closed;

	const claimId = readId(data, 'claimId');
	const result = claimId === null ? null : await undoClaim(db, team.id, claimId);
	switch (result?.status) {
		case 'undone':
			return { status: 200, result: { kind: 'undone' } };
		case 'conflict':
			return error(409, conflictMessage(result.claim));
		default:
			return error(404, 'This claim was already undone.');
	}
}

/** Allowed outside the game window: a name is not a claim. */
export async function renameOwnTeam(
	db: D1Database,
	{ team, game }: TeamLink,
	data: FormData
): Promise<TeamOutcome> {
	const name = normalizeTeamName(data.get('name'));
	if (!name) return error(400, TEAM_NAME_ERROR);
	const members = normalizeTeamMembers(data.get('members'));
	if (members === null) return error(400, TEAM_MEMBERS_ERROR);
	if (!(await updateTeam(db, game.id, team.id, { name, members }))) {
		return error(404, DEAD_LINK_MESSAGE);
	}
	return { status: 200, result: { kind: 'renamed' } };
}

/** Allowed outside the game window, like a rename. */
export async function saveOwnAvatar(
	db: D1Database,
	bucket: ImageBucket,
	{ team, game }: TeamLink,
	data: FormData
): Promise<TeamOutcome> {
	const read = await readImageUpload(data, 'avatar', AVATAR_MAX_BYTES);
	if (read.status === 'missing') return error(400, 'Choose a picture first.');
	if (read.status === 'invalid') return error(400, read.message);

	const stored = await replaceImage(bucket, game.id, read.upload, (key) =>
		setTeamAvatar(db, game.id, team.id, key)
	);
	if (!stored) return error(404, DEAD_LINK_MESSAGE);
	return { status: 200, result: { kind: 'avatar-saved' } };
}

function closedOutcome(game: TeamLink['game'], now: Date): TeamOutcome | null {
	const phase = gamePhase({ startsAt: game.starts_at, endsAt: game.ends_at }, now);
	return phase === 'during' ? null : { status: 403, result: { kind: 'closed', phase } };
}
