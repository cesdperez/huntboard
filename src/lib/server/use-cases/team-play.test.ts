import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_NOTE_MAX_LENGTH } from '#lib/domain/claim-note.js';
import { listTeamClaims } from '../db/claims.js';
import { createGame, updateGameSettings } from '../db/games.js';
import { getTeamByToken } from '../db/links.js';
import { isTeamUpload, recordMediaUpload } from '../db/media-uploads.js';
import { deleteTeam } from '../db/teams.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from '../db/types.js';
import {
	GAME_MEDIA_MAX_BYTES,
	ORIGINAL_VIDEO_MAX_BYTES,
	PHOTO_MAX_BYTES,
	TEAM_MEDIA_MAX_BYTES,
	TEAM_UPLOADS_PER_CHALLENGE
} from '#lib/domain/claim-media.js';
import { MEDIA_NOT_UPLOADED, NOT_MEDIA, PHOTO_TOO_LARGE, VIDEO_TOO_LARGE } from './claim-media.js';
import { NOT_AN_IMAGE } from './image-upload.js';
import {
	GAME_MEDIA_FULL,
	MEDIA_TAKEN,
	MEDIA_UPLOADS_OFF,
	TEAM_MEDIA_FULL,
	markDone,
	renameOwnTeam,
	requestMediaUpload,
	saveOwnAvatar,
	undoOwnClaim
} from './team-play.js';
import { newMediaKey } from '../storage/media-store.js';
import type { MediaPresigner } from '../storage/media-upload.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const DURING = new Date('2026-06-01T18:00:00.000Z');
const BEFORE = new Date('2026-06-01T15:00:00.000Z');
const AFTER = new Date('2026-06-01T21:00:00.000Z');

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let swim: ChallengeRow;
let media: MemoryBucket;

beforeEach(async () => {
	db = createTestDb();
	media = new MemoryBucket();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 0,
		theme: 'flag'
	});
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

function signedFor(team: TeamRow, key: string, size = 1, gameId = game.id) {
	const roomy = { uploadsPerChallenge: 1000, teamMaxBytes: 2 ** 40, gameMaxBytes: 2 ** 40 };
	return recordMediaUpload(db, { gameId, teamId: team.id, key, size }, roomy);
}

function markForm(fields: Record<string, string> = {}) {
	return form({ challengeId: String(swim.id), nickname: 'Sam', note: '', ...fields });
}

describe('markDone', () => {
	it('adds a pending claim with the trimmed note and the nickname', async () => {
		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ note: '  photo at 17:02 ' }),
			DURING
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'marked' } });
		expect(await listTeamClaims(db, rats.id)).toEqual([
			expect.objectContaining({ status: 'pending', note: 'photo at 17:02', marked_by: 'Sam' })
		]);
	});

	it('stores an empty note as no note', async () => {
		await markDone(db, media.asBucket(), { team: rats, game }, markForm({ note: '   ' }), DURING);

		expect((await listTeamClaims(db, rats.id))[0].note).toBeNull();
	});

	it.each([
		['before', BEFORE],
		['after', AFTER]
	] as const)('refuses %s the game window and stores nothing', async (phase, now) => {
		const outcome = await markDone(db, media.asBucket(), { team: rats, game }, markForm(), now);

		expect(outcome).toEqual({ status: 403, result: { kind: 'closed', phase } });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses while the game has no times', async () => {
		const unscheduled = { ...game, starts_at: null, ends_at: null };

		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game: unscheduled },
			markForm(),
			DURING
		);

		expect(outcome.result).toEqual({ kind: 'closed', phase: 'before' });
	});

	it('asks for a nickname when there is none', async () => {
		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ nickname: '  ' }),
			DURING
		);

		expect(outcome.status).toBe(400);
		expect(outcome.result).toEqual({
			kind: 'error',
			message: 'Set your nickname first, so the judge knows who marked this.'
		});
	});

	it('refuses a note that is too long', async () => {
		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ note: 'x'.repeat(CLAIM_NOTE_MAX_LENGTH + 1) }),
			DURING
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'error',
				message: `Keep the note to at most ${CLAIM_NOTE_MAX_LENGTH} characters.`
			}
		});
	});

	it('names the teammate who marked it first', async () => {
		await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });

		const outcome = await markDone(db, media.asBucket(), { team: rats, game }, markForm(), DURING);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Kim already marked this done.' }
		});
	});

	it.each(['9999', 'abc', ''])('refuses an unknown challenge id %j', async (challengeId) => {
		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ challengeId }),
			DURING
		);

		expect(outcome).toEqual({
			status: 404,
			result: { kind: 'error', message: 'That challenge is not in this game any more.' }
		});
	});
});

describe('markDone with media', () => {
	const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);

	async function uploaded(bytes = JPEG, contentType = 'image/jpeg') {
		const key = newMediaKey(game.id, 'image/jpeg');
		await media.put(key, bytes, { httpMetadata: { contentType } });
		await signedFor(rats, key);
		return key;
	}

	it('attaches a photo that is in the media bucket', async () => {
		const key = await uploaded();

		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ mediaKey: key }),
			DURING
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'marked' } });
		expect((await listTeamClaims(db, rats.id))[0].media_key).toBe(key);
	});

	it('stores no media key without media', async () => {
		await markDone(db, media.asBucket(), { team: rats, game }, markForm(), DURING);

		expect((await listTeamClaims(db, rats.id))[0].media_key).toBeNull();
	});

	it.each([
		[
			'a key of another game',
			async () => newMediaKey(game.id + 1, 'image/jpeg'),
			MEDIA_NOT_UPLOADED
		],
		[
			'a key with nothing uploaded',
			async () => newMediaKey(game.id, 'image/jpeg'),
			MEDIA_NOT_UPLOADED
		],
		[
			'bytes that are not the type the key names',
			() => uploaded(new TextEncoder().encode('<svg/>')),
			NOT_MEDIA
		]
	])('refuses %s and stores no claim', async (_, key, message) => {
		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ mediaKey: await key() }),
			DURING
		);

		expect(outcome).toEqual({ status: 400, result: { kind: 'error', message } });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses media another claim already has, and keeps that claim and its media', async () => {
		const key = await uploaded();
		const rejected = await seedClaim(db, rats.id, swim.id, {
			status: 'rejected',
			media_key: key
		});

		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ mediaKey: key }),
			DURING
		);

		expect(outcome).toEqual({ status: 409, result: { kind: 'error', message: MEDIA_TAKEN } });
		expect(await listTeamClaims(db, rats.id)).toEqual([rejected]);
		expect(await media.head(key)).not.toBeNull();
	});

	it('refuses a key signed for another team', async () => {
		const owls = await seedTeam(db, game.id, { name: 'Bridge Owls' });
		const key = newMediaKey(game.id, 'image/jpeg');
		await media.put(key, JPEG, { httpMetadata: { contentType: 'image/jpeg' } });
		await signedFor(owls, key);

		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ mediaKey: key }),
			DURING
		);

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: MEDIA_NOT_UPLOADED }
		});
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses outside the game window before looking at the media', async () => {
		const head = vi.spyOn(media, 'head');

		const outcome = await markDone(
			db,
			media.asBucket(),
			{ team: rats, game },
			markForm({ mediaKey: await uploaded() }),
			AFTER
		);

		expect(outcome.status).toBe(403);
		expect(head).not.toHaveBeenCalled();
	});
});

describe('requestMediaUpload', () => {
	const presign: MediaPresigner = async (key, type, size) => ({
		url: `https://r2.example/${key}?size=${size}`,
		headers: { 'Content-Type': type }
	});

	function uploadForm(type: string, size: number | string) {
		return form({ type, size: String(size) });
	}

	it('presigns a new key under the game for the declared type and size', async () => {
		const outcome = await requestMediaUpload(
			db,
			presign,
			{ team: rats, game },
			uploadForm('video/mp4', 1234),
			DURING
		);

		expect(outcome).toEqual({
			status: 200,
			result: {
				kind: 'media-upload',
				key: expect.stringMatching(new RegExp(`^${game.id}/claims/[A-Za-z0-9_-]{22}\\.mp4$`)),
				url: expect.stringMatching(/^https:\/\/r2\.example\/.+\?size=1234$/),
				headers: { 'Content-Type': 'video/mp4' }
			}
		});
	});

	it('refuses outside the game window', async () => {
		const outcome = await requestMediaUpload(
			db,
			presign,
			{ team: rats, game },
			uploadForm('image/jpeg', 100),
			AFTER
		);

		expect(outcome).toEqual({ status: 403, result: { kind: 'closed', phase: 'after' } });
	});

	it.each([
		['a type the app does not take', uploadForm('image/png', 100), NOT_MEDIA],
		['a missing size', uploadForm('image/jpeg', ''), NOT_MEDIA],
		['an empty file', uploadForm('image/jpeg', 0), NOT_MEDIA],
		['a size that is not a whole number', uploadForm('image/jpeg', '1.5'), NOT_MEDIA],
		['a photo over the limit', uploadForm('image/jpeg', PHOTO_MAX_BYTES + 1), PHOTO_TOO_LARGE],
		[
			'a video over the limit',
			uploadForm('video/webm', ORIGINAL_VIDEO_MAX_BYTES + 1),
			VIDEO_TOO_LARGE
		]
	])('refuses %s', async (_, data, message) => {
		const outcome = await requestMediaUpload(db, presign, { team: rats, game }, data, DURING);

		expect(outcome).toEqual({ status: 400, result: { kind: 'error', message } });
	});

	it('records the key as signed for the team', async () => {
		const outcome = await requestMediaUpload(
			db,
			presign,
			{ team: rats, game },
			uploadForm('image/jpeg', 100),
			DURING
		);

		const { key } = outcome.result as { key: string };
		expect(await isTeamUpload(db, rats.id, key)).toBe(true);
	});

	it(`allows ${TEAM_UPLOADS_PER_CHALLENGE} uploads per challenge for each team`, async () => {
		const ask = () =>
			requestMediaUpload(db, presign, { team: rats, game }, uploadForm('image/jpeg', 100), DURING);
		for (let i = 0; i < TEAM_UPLOADS_PER_CHALLENGE; i++) expect((await ask()).status).toBe(200);

		expect(await ask()).toEqual({
			status: 400,
			result: { kind: 'error', message: TEAM_MEDIA_FULL }
		});
	});

	it('refuses an upload past the team bytes', async () => {
		await signedFor(rats, 'earlier', TEAM_MEDIA_MAX_BYTES - 99);

		const outcome = await requestMediaUpload(
			db,
			presign,
			{ team: rats, game },
			uploadForm('image/jpeg', 100),
			DURING
		);

		expect(outcome).toEqual({ status: 400, result: { kind: 'error', message: TEAM_MEDIA_FULL } });
	});

	it('refuses an upload past the game bytes, whichever team sent the rest', async () => {
		const owls = await seedTeam(db, game.id, { name: 'Bridge Owls' });
		await signedFor(owls, 'earlier', GAME_MEDIA_MAX_BYTES - 99);

		const outcome = await requestMediaUpload(
			db,
			presign,
			{ team: rats, game },
			uploadForm('image/jpeg', 100),
			DURING
		);

		expect(outcome).toEqual({ status: 400, result: { kind: 'error', message: GAME_MEDIA_FULL } });
	});

	it('says uploads are off when the server cannot presign', async () => {
		const outcome = await requestMediaUpload(
			db,
			null,
			{ team: rats, game },
			uploadForm('image/jpeg', 100),
			DURING
		);

		expect(outcome).toEqual({ status: 503, result: { kind: 'error', message: MEDIA_UPLOADS_OFF } });
	});
});

describe('undoOwnClaim', () => {
	it('removes a pending claim', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await undoOwnClaim(
			db,
			media.asBucket(),
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			DURING
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'undone' } });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('deletes the media of the claim it removes', async () => {
		const key = newMediaKey(game.id, 'video/mp4');
		await media.put(key, new Uint8Array(8));
		const claim = await seedClaim(db, rats.id, swim.id, { media_key: key });

		await undoOwnClaim(
			db,
			media.asBucket(),
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			DURING
		);

		expect(media.keys()).toEqual([]);
	});

	it('refuses outside the game window and keeps the claim', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await undoOwnClaim(
			db,
			media.asBucket(),
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			AFTER
		);

		expect(outcome).toEqual({ status: 403, result: { kind: 'closed', phase: 'after' } });
		expect(await listTeamClaims(db, rats.id)).toHaveLength(1);
	});

	it('names the judge who scored it first', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Alex'
		});

		const outcome = await undoOwnClaim(
			db,
			media.asBucket(),
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			DURING
		);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Alex already scored this: 15 points.' }
		});
	});

	it('says the claim is gone when a teammate undid it or a re-import deleted it', async () => {
		const outcome = await undoOwnClaim(
			db,
			media.asBucket(),
			{ team: rats, game },
			form({ claimId: '9999' }),
			DURING
		);

		expect(outcome).toEqual({
			status: 404,
			result: {
				kind: 'error',
				message: 'This claim is not in this game any more. Reload the page.'
			}
		});
	});
});

describe('renameOwnTeam', () => {
	it('renames the team, collapsing spaces', async () => {
		const outcome = await renameOwnTeam(
			db,
			{ team: rats, game },
			form({ name: '  Canal   Kings ' })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'renamed' } });
		expect((await getTeamByToken(db, rats.token))?.name).toBe('Canal Kings');
	});

	it('saves the members next to the name', async () => {
		await renameOwnTeam(
			db,
			{ team: rats, game },
			form({ name: 'Canal Rats', members: ' Ana,  Bo ' })
		);

		expect((await getTeamByToken(db, rats.token))?.members).toBe('Ana, Bo');
	});

	it('refuses members that are too long and keeps the old ones', async () => {
		const outcome = await renameOwnTeam(
			db,
			{ team: rats, game },
			form({ name: 'Kings', members: 'a'.repeat(81) })
		);

		expect(outcome.status).toBe(400);
		expect((await getTeamByToken(db, rats.token))?.name).toBe('Canal Rats');
	});

	it('works outside the game window', async () => {
		const ended = { ...game, starts_at: null, ends_at: null };

		const outcome = await renameOwnTeam(db, { team: rats, game: ended }, form({ name: 'Kings' }));

		expect(outcome.status).toBe(200);
	});

	it('reports a team deleted since its link was opened', async () => {
		await deleteTeam(db, game.id, rats.id);

		const outcome = await renameOwnTeam(db, { team: rats, game }, form({ name: 'Kings' }));

		expect(outcome).toEqual({
			status: 404,
			result: {
				kind: 'error',
				message: 'This link does not work any more. Ask your organiser for the current link.'
			}
		});
	});

	it('refuses an empty name and keeps the old one', async () => {
		const outcome = await renameOwnTeam(db, { team: rats, game }, form({ name: ' ' }));

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: 'Give the team a name of at most 40 characters.' }
		});
		expect((await getTeamByToken(db, rats.token))?.name).toBe('Canal Rats');
	});

	it('refuses the name of another team in the game and keeps the old one', async () => {
		await seedTeam(db, game.id, { name: 'Night Owls' });

		const outcome = await renameOwnTeam(db, { team: rats, game }, form({ name: 'night owls' }));

		expect(outcome).toEqual({
			status: 409,
			result: {
				kind: 'error',
				message: 'Another team already has this name. Choose another one.'
			}
		});
		expect((await getTeamByToken(db, rats.token))?.name).toBe('Canal Rats');
	});
});

describe('saveOwnAvatar', () => {
	const WEBP = new TextEncoder().encode('RIFF\x24\x00\x00\x00WEBPVP8 ');
	let bucket: MemoryBucket;

	beforeEach(() => {
		bucket = new MemoryBucket();
	});

	function avatarForm(bytes: Uint8Array<ArrayBuffer>, type: string) {
		const data = new FormData();
		data.set('avatar', new Blob([bytes], { type }), 'avatar');
		return data;
	}

	it('stores the picture under the game and replaces the old one, outside the game window too', async () => {
		const ended = { ...game, starts_at: null, ends_at: null };
		await bucket.put(`${game.id}/oldoldoldoldoldoldoldo.webp`, WEBP);
		await db
			.prepare('UPDATE team SET avatar_key = ? WHERE id = ?')
			.bind(`${game.id}/oldoldoldoldoldoldoldo.webp`, rats.id)
			.run();

		const outcome = await saveOwnAvatar(
			db,
			bucket.asBucket(),
			{ team: rats, game: ended },
			avatarForm(WEBP, 'image/webp')
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'avatar-saved' } });
		const key = (await getTeamByToken(db, rats.token))?.avatar_key;
		expect(key).toMatch(new RegExp(`^${game.id}/.+\\.webp$`));
		expect(bucket.keys()).toEqual([key]);
	});

	it('refuses a file that is not a JPEG or WebP image', async () => {
		const outcome = await saveOwnAvatar(
			db,
			bucket.asBucket(),
			{ team: rats, game },
			avatarForm(new TextEncoder().encode('<svg/>'), 'image/svg+xml')
		);

		expect(outcome).toEqual({ status: 400, result: { kind: 'error', message: NOT_AN_IMAGE } });
		expect(bucket.keys()).toEqual([]);
	});

	it('asks for a picture when none is sent', async () => {
		const outcome = await saveOwnAvatar(
			db,
			bucket.asBucket(),
			{ team: rats, game },
			new FormData()
		);

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: 'Choose a picture first.' }
		});
	});

	it('reports a team deleted since its link was opened and keeps no picture', async () => {
		await deleteTeam(db, game.id, rats.id);

		const outcome = await saveOwnAvatar(
			db,
			bucket.asBucket(),
			{ team: rats, game },
			avatarForm(WEBP, 'image/webp')
		);

		expect(outcome.status).toBe(404);
		expect(bucket.keys()).toEqual([]);
	});
});
