import { beforeEach, describe, expect, it } from 'vitest';
import { CLAIM_NOTE_MAX_LENGTH } from '#lib/claim-note.js';
import { listTeamClaims } from './db/claims.js';
import { createGame, updateGameSettings } from './db/games.js';
import { getTeamByToken } from './db/links.js';
import { createTestDb } from './db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './db/testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from './db/types.js';
import { markDone, renameOwnTeam, undoOwnClaim } from './team-play.js';

const DURING = new Date('2026-06-01T18:00:00.000Z');
const BEFORE = new Date('2026-06-01T15:00:00.000Z');
const AFTER = new Date('2026-06-01T21:00:00.000Z');

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let swim: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 0
	});
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

function markForm(fields: Record<string, string> = {}) {
	return form({ challengeId: String(swim.id), nickname: 'Sam', note: '', ...fields });
}

describe('markDone', () => {
	it('adds a pending claim with the trimmed note and the nickname', async () => {
		const outcome = await markDone(
			db,
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
		await markDone(db, { team: rats, game }, markForm({ note: '   ' }), DURING);

		expect((await listTeamClaims(db, rats.id))[0].note).toBeNull();
	});

	it.each([
		['before', BEFORE],
		['after', AFTER]
	] as const)('refuses %s the game window and stores nothing', async (phase, now) => {
		const outcome = await markDone(db, { team: rats, game }, markForm(), now);

		expect(outcome).toEqual({ status: 403, result: { kind: 'closed', phase } });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses while the game has no times', async () => {
		const unscheduled = { ...game, starts_at: null, ends_at: null };

		const outcome = await markDone(db, { team: rats, game: unscheduled }, markForm(), DURING);

		expect(outcome.result).toEqual({ kind: 'closed', phase: 'before' });
	});

	it('asks for a nickname when there is none', async () => {
		const outcome = await markDone(db, { team: rats, game }, markForm({ nickname: '  ' }), DURING);

		expect(outcome.status).toBe(400);
		expect(outcome.result).toEqual({
			kind: 'error',
			message: 'Set your nickname first, so the judge knows who marked this.'
		});
	});

	it('refuses a note that is too long', async () => {
		const outcome = await markDone(
			db,
			{ team: rats, game },
			markForm({ note: 'x'.repeat(CLAIM_NOTE_MAX_LENGTH + 1) }),
			DURING
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'error',
				message: `Keep the note under ${CLAIM_NOTE_MAX_LENGTH} characters.`
			}
		});
	});

	it('names the teammate who marked it first', async () => {
		await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });

		const outcome = await markDone(db, { team: rats, game }, markForm(), DURING);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Kim already marked this done.' }
		});
	});

	it.each(['9999', 'abc', ''])('refuses an unknown challenge id %j', async (challengeId) => {
		const outcome = await markDone(db, { team: rats, game }, markForm({ challengeId }), DURING);

		expect(outcome).toEqual({
			status: 404,
			result: { kind: 'error', message: 'That challenge is not in this game any more.' }
		});
	});
});

describe('undoOwnClaim', () => {
	it('removes a pending claim', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await undoOwnClaim(
			db,
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			DURING
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'undone' } });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses outside the game window and keeps the claim', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await undoOwnClaim(
			db,
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
			{ team: rats, game },
			form({ claimId: String(claim.id) }),
			DURING
		);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Alex already scored this: 15 points.' }
		});
	});

	it('says the claim is gone when a teammate already undid it', async () => {
		const outcome = await undoOwnClaim(db, { team: rats, game }, form({ claimId: '9999' }), DURING);

		expect(outcome).toEqual({
			status: 404,
			result: { kind: 'error', message: 'This claim was already undone.' }
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

	it('works outside the game window', async () => {
		const ended = { ...game, starts_at: null, ends_at: null };

		const outcome = await renameOwnTeam(db, { team: rats, game: ended }, form({ name: 'Kings' }));

		expect(outcome.status).toBe(200);
	});

	it('refuses an empty name and keeps the old one', async () => {
		const outcome = await renameOwnTeam(db, { team: rats, game }, form({ name: ' ' }));

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: 'Give the team a name of at most 40 characters.' }
		});
		expect((await getTeamByToken(db, rats.token))?.name).toBe('Canal Rats');
	});
});
