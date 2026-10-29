import { isMediaType, maxMediaBytes } from '#lib/domain/claim-media.js';
import { CLAIM_NOTE_MAX_LENGTH } from '#lib/domain/claim-note.js';
import { DEAD_LINK_MESSAGE } from '#lib/domain/dead-link.js';
import { gamePhase, type GamePhase } from '#lib/domain/game-window.js';
import { AVATAR_MAX_BYTES } from '#lib/domain/images.js';
import { normalizeNickname } from '#lib/domain/nickname.js';
import {
	TEAM_MEMBERS_ERROR,
	TEAM_NAME_ERROR,
	normalizeTeamMembers,
	normalizeTeamName
} from '#lib/domain/team-name.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { markClaim, undoClaim } from '../db/claims.js';
import { setTeamAvatar } from '../db/images.js';
import { updateTeam } from '../db/teams.js';
import { deleteObjects } from '../storage/bucket-objects.js';
import { newMediaKey, type MediaBucket } from '../storage/media-store.js';
import type { MediaPresigner, MediaUploadTarget } from '../storage/media-upload.js';
import { checkClaimMedia, mediaTooLarge, NOT_MEDIA } from './claim-media.js';
import { conflictMessage } from './conflict-message.js';
import { readId, readString } from './form.js';
import { replaceImage, type ImageBucket } from '../storage/image-store.js';
import { readImageUpload } from './image-upload.js';
import type { TeamLink } from '../db/links.js';

/**
 * What a team action returns under `team`. A closed window carries only the phase,
 * because the message names a time and only the browser knows the viewer's time zone.
 */
export type TeamFormResult =
	| { kind: 'marked' }
	| { kind: 'undone' }
	| { kind: 'renamed' }
	| { kind: 'avatar-saved' }
	/** Where to PUT the file before marking done with `mediaKey` set to key. */
	| ({ kind: 'media-upload'; key: string } & MediaUploadTarget)
	| { kind: 'closed'; phase: Exclude<GamePhase, 'during'> }
	| ErrorResult;

type TeamOutcome = ActionOutcome<TeamFormResult>;

const CHALLENGE_GONE = 'That challenge is not in this game any more.';
export const MEDIA_UPLOADS_OFF =
	'Photos and videos cannot be attached right now. Mark it done without one and send the proof another way.';

/** Media is optional. When sent, it must already be in the bucket and pass checkClaimMedia. */
export async function markDone(
	db: D1Database,
	media: MediaBucket,
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
	const mediaKey = readString(data, 'mediaKey') || null;
	const mediaError = mediaKey === null ? null : await checkClaimMedia(media, game.id, mediaKey);
	if (mediaError) return error(400, mediaError);

	const result = await markClaim(db, {
		gameId: game.id,
		teamId: team.id,
		challengeId,
		note: note || null,
		markedBy,
		mediaKey
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

/**
 * Presigns the upload of one photo or video of the declared type and size. A null presigner
 * means this server has no way to take uploads.
 */
export async function requestMediaUpload(
	presign: MediaPresigner | null,
	{ game }: TeamLink,
	data: FormData,
	now: Date
): Promise<TeamOutcome> {
	const closed = closedOutcome(game, now);
	if (closed) return closed;
	if (!presign) return error(503, MEDIA_UPLOADS_OFF);

	const type = data.get('type');
	const size = Number(readString(data, 'size'));
	if (!isMediaType(type) || !Number.isSafeInteger(size) || size <= 0) {
		return error(400, NOT_MEDIA);
	}
	if (size > maxMediaBytes(type)) return error(400, mediaTooLarge(type));

	const key = newMediaKey(game.id, type);
	const target = await presign(key, type, size, now);
	return { status: 200, result: { kind: 'media-upload', key, ...target } };
}

export async function undoOwnClaim(
	db: D1Database,
	media: MediaBucket,
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
			await deleteObjects(media, [result.mediaKey]);
			return { status: 200, result: { kind: 'undone' } };
		case 'conflict':
			return error(409, conflictMessage(result.claim));
		default:
			return error(404, 'This claim is not in this game any more. Reload the page.');
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
