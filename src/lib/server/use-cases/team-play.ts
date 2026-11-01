import {
	GAME_MEDIA_MAX_BYTES,
	isMediaType,
	maxMediaBytes,
	TEAM_MEDIA_MAX_BYTES,
	TEAM_UPLOADS_PER_CHALLENGE
} from '#lib/domain/claim-media.js';
import { CLAIM_NOTE_MAX_LENGTH } from '#lib/domain/claim-note.js';
import { DEAD_LINK_MESSAGE } from '#lib/domain/dead-link.js';
import { gamePhase, type GamePhase } from '#lib/domain/game-window.js';
import { AVATAR_MAX_BYTES } from '#lib/domain/images.js';
import { normalizeNickname } from '#lib/domain/nickname.js';
import {
	TEAM_MEMBERS_ERROR,
	TEAM_NAME_TAKEN_ERROR,
	normalizeTeamMembers,
	normalizeTeamName,
	teamNameError
} from '#lib/domain/team-name.js';
import { error, type ActionOutcome, type ErrorResult } from './action-outcome.js';
import { editClaim, markClaim, undoClaim, type ClaimEdit } from '../db/claims.js';
import { setTeamAvatar } from '../db/images.js';
import { isTeamUpload, recordMediaUpload } from '../db/media-uploads.js';
import { updateTeam } from '../db/teams.js';
import { deleteObjects } from '../storage/bucket-objects.js';
import { newMediaKey, type MediaBucket } from '../storage/media-store.js';
import type { MediaPresigner, MediaUploadTarget } from '../storage/media-upload.js';
import { checkClaimMedia, MEDIA_NOT_UPLOADED, mediaTooLarge, NOT_MEDIA } from './claim-media.js';
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
	| { kind: 'edited' }
	| { kind: 'renamed' }
	| { kind: 'avatar-saved' }
	/** Where to PUT the file before marking done with `mediaKey` set to key. */
	| ({ kind: 'media-upload'; key: string } & MediaUploadTarget)
	| { kind: 'closed'; phase: Exclude<GamePhase, 'during'> }
	| ErrorResult;

type TeamOutcome = ActionOutcome<TeamFormResult>;

const CHALLENGE_GONE = 'That challenge is not in this game any more.';
export const CLAIM_GONE = 'This claim is not in this game any more. Reload the page.';
const CHANGES_NOT_SAVED = 'Your changes were not saved.';
export const MEDIA_TAKEN = 'This photo or video is already on another claim. Attach it again.';
export const MEDIA_UPLOADS_OFF =
	'Photos and videos cannot be attached right now. Mark it done without one and send the proof another way.';
export const TEAM_MEDIA_FULL =
	'Your team has sent all the photos and videos this game allows. Mark it done without one and show a judge in person.';
export const GAME_MEDIA_FULL =
	'This game has no room left for photos and videos. Mark it done without one and show a judge in person.';

const UPLOAD_LIMITS = {
	uploadsPerChallenge: TEAM_UPLOADS_PER_CHALLENGE,
	teamMaxBytes: TEAM_MEDIA_MAX_BYTES,
	gameMaxBytes: GAME_MEDIA_MAX_BYTES
};

/** Media is optional. When sent, it must be signed for this team, in the bucket, and pass checkClaimMedia. */
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
	const note = readNote(data);
	if (note === undefined) return noteTooLong();
	const challengeId = readId(data, 'challengeId');
	if (challengeId === null) return error(404, CHALLENGE_GONE);
	const mediaKey = readString(data, 'mediaKey') || null;
	if (mediaKey !== null) {
		const mediaError = await attachableMediaError(db, media, { team, game }, mediaKey);
		if (mediaError) return mediaError;
	}

	const result = await markClaim(db, {
		gameId: game.id,
		teamId: team.id,
		challengeId,
		note,
		markedBy,
		mediaKey
	});
	switch (result.status) {
		case 'marked':
			return { status: 200, result: { kind: 'marked' } };
		case 'conflict':
			return error(409, conflictMessage(result.claim));
		case 'media-taken':
			return error(409, MEDIA_TAKEN);
		case 'team-gone':
			return error(404, DEAD_LINK_MESSAGE);
		case 'not-found':
			return error(404, CHALLENGE_GONE);
	}
}

/**
 * Changes the note and, by `media`, keeps, removes or replaces the photo or video of a pending
 * claim. A replacement passes the same checks as media sent with markDone.
 */
export async function editOwnClaim(
	db: D1Database,
	media: MediaBucket,
	{ team, game }: TeamLink,
	data: FormData,
	now: Date
): Promise<TeamOutcome> {
	const closed = closedOutcome(game, now);
	if (closed) return closed;

	const editedBy = normalizeNickname(data.get('nickname'));
	if (!editedBy) return error(400, 'Set your nickname first, so the judge knows who edited this.');
	const note = readNote(data);
	if (note === undefined) return noteTooLong();
	const claimId = readId(data, 'claimId');
	if (claimId === null) return error(404, CLAIM_GONE);
	const change = await readMediaChange(db, media, { team, game }, data);
	if ('status' in change) return change;

	const result = await editClaim(db, { teamId: team.id, claimId, note, editedBy, media: change });
	switch (result.status) {
		case 'edited':
			await deleteObjects(media, [result.replacedMediaKey]);
			return { status: 200, result: { kind: 'edited' } };
		case 'conflict':
			return error(409, `${conflictMessage(result.claim)} ${CHANGES_NOT_SAVED}`);
		case 'media-taken':
			return error(409, MEDIA_TAKEN);
		case 'not-found':
			return error(404, CLAIM_GONE);
	}
}

async function readMediaChange(
	db: D1Database,
	media: MediaBucket,
	link: TeamLink,
	data: FormData
): Promise<ClaimEdit['media'] | TeamOutcome> {
	switch (readString(data, 'media')) {
		case 'remove':
			return { kind: 'set', key: null };
		case 'replace': {
			const key = readString(data, 'mediaKey');
			if (!key) return error(400, MEDIA_NOT_UPLOADED);
			return (await attachableMediaError(db, media, link, key)) ?? { kind: 'set', key };
		}
		default:
			return { kind: 'keep' };
	}
}

async function attachableMediaError(
	db: D1Database,
	media: MediaBucket,
	{ team, game }: TeamLink,
	key: string
): Promise<TeamOutcome | null> {
	const [signedForTeam, mediaError] = await Promise.all([
		isTeamUpload(db, team.id, key),
		checkClaimMedia(media, game.id, key)
	]);
	if (!signedForTeam) return error(400, MEDIA_NOT_UPLOADED);
	if (mediaError) return error(400, mediaError);
	return null;
}

/** The trimmed note, null when empty, or undefined when too long. */
function readNote(data: FormData): string | null | undefined {
	const note = readString(data, 'note');
	if (note.length > CLAIM_NOTE_MAX_LENGTH) return undefined;
	return note || null;
}

function noteTooLong(): TeamOutcome {
	return error(400, `Keep the note to at most ${CLAIM_NOTE_MAX_LENGTH} characters.`);
}

/**
 * Presigns the upload of one photo or video of the declared type and size. A null presigner
 * means this server has no way to take uploads.
 */
export async function requestMediaUpload(
	db: D1Database,
	presign: MediaPresigner | null,
	{ team, game }: TeamLink,
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
	// Sign before recording, so a failed signature does not spend the team's budget.
	const target = await presign(key, type, size, now);
	const upload = { gameId: game.id, teamId: team.id, key, size };
	switch (await recordMediaUpload(db, upload, UPLOAD_LIMITS)) {
		case 'team-count':
		case 'team-bytes':
			return error(400, TEAM_MEDIA_FULL);
		case 'game-bytes':
			return error(400, GAME_MEDIA_FULL);
		case 'team-gone':
			return error(404, DEAD_LINK_MESSAGE);
	}
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
			return error(404, CLAIM_GONE);
	}
}

/** Allowed outside the game window: a name is not a claim. */
export async function renameOwnTeam(
	db: D1Database,
	{ team, game }: TeamLink,
	data: FormData
): Promise<TeamOutcome> {
	const name = normalizeTeamName(data.get('name'));
	if (!name) return error(400, teamNameError(data.get('name')));
	const members = normalizeTeamMembers(data.get('members'));
	if (members === null) return error(400, TEAM_MEMBERS_ERROR);
	switch (await updateTeam(db, game.id, team.id, { name, members })) {
		case 'not-found':
			return error(404, DEAD_LINK_MESSAGE);
		case 'name-taken':
			return error(409, TEAM_NAME_TAKEN_ERROR);
		case 'updated':
			return { status: 200, result: { kind: 'renamed' } };
	}
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
