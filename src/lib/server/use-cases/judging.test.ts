import { beforeEach, describe, expect, it } from 'vitest';
import { REASON_MAX_LENGTH } from '#lib/domain/reason.js';
import { listTeamClaims } from '../db/claims.js';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from '../db/types.js';
import { checkJudgement, rejectClaim, scoreClaim, scoreOpenCell } from './judging.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let swim: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	swim = await seedChallenge(db, game.id, { min_points: 5, max_points: 20 });
});

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('scoreClaim', () => {
	it('scores a pending claim with the judge nickname', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', points: '12', nickname: 'Alex' })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'scored', points: 12 } });
		expect((await listTeamClaims(db, rats.id))[0]).toMatchObject({
			status: 'scored',
			points: 12,
			judged_by: 'Alex'
		});
	});

	it('says how many points a value outside the range became', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', points: '99', nickname: 'Alex' })
		);

		expect(outcome.result).toEqual({ kind: 'scored', points: 20 });
	});

	it('names the judge who got there first', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Sam'
		});

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', points: '12', nickname: 'Alex' })
		);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Sam already scored this: 15 points.' }
		});
	});

	it('fixes a scored claim when the judge saw it scored', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Sam'
		});

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'scored', points: '8', nickname: 'Alex' })
		);

		expect(outcome.result).toEqual({ kind: 'scored', points: 8 });
	});

	it('treats an unknown state as pending, the stricter rule', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 15 });

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'whatever', points: '8', nickname: 'Alex' })
		);

		expect(outcome.status).toBe(409);
	});

	it.each(['pending', 'scored'])('says a %s claim that is gone left the game', async (from) => {
		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: '9999', from, points: '8', nickname: 'Alex' })
		);

		expect(outcome).toEqual({
			status: 404,
			result: {
				kind: 'error',
				message: 'This claim is not in this game any more. Reload the page.'
			}
		});
	});

	it('asks for a nickname when there is none', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', points: '8', nickname: ' ' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'error',
				message: 'Set your nickname first, so everyone knows who judged this.'
			}
		});
		expect((await listTeamClaims(db, rats.id))[0].status).toBe('pending');
	});

	it.each(['', 'ten', '7.5'])('refuses %j points', async (points) => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await scoreClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', points, nickname: 'Alex' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'error', message: 'Enter a whole number of points.' }
		});
	});
});

describe('rejectClaim', () => {
	it('rejects with the trimmed reason', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await rejectClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', reason: ' No proof ', nickname: 'Alex' })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'rejected' } });
		expect((await listTeamClaims(db, rats.id))[0]).toMatchObject({
			status: 'rejected',
			judge_note: 'No proof',
			judged_by: 'Alex'
		});
	});

	it('collapses runs of spaces in the reason, as for adjustments', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		await rejectClaim(
			db,
			game.id,
			form({
				claimId: String(claim.id),
				from: 'pending',
				reason: 'No   proof\nseen',
				nickname: 'Alex'
			})
		);

		expect((await listTeamClaims(db, rats.id))[0].judge_note).toBe('No proof seen');
	});

	it('stores an empty reason as no reason', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		await rejectClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', reason: '  ', nickname: 'Alex' })
		);

		expect((await listTeamClaims(db, rats.id))[0].judge_note).toBeNull();
	});

	it('refuses a reason that is too long', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await rejectClaim(
			db,
			game.id,
			form({
				claimId: String(claim.id),
				from: 'pending',
				reason: 'x'.repeat(REASON_MAX_LENGTH + 1),
				nickname: 'Alex'
			})
		);

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'error',
				message: `Keep the reason to at most ${REASON_MAX_LENGTH} characters.`
			}
		});
	});

	it('names the judge who rejected it first', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'rejected', judged_by: 'Sam' });

		const outcome = await rejectClaim(
			db,
			game.id,
			form({ claimId: String(claim.id), from: 'pending', reason: '', nickname: 'Alex' })
		);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Sam already rejected this.' }
		});
	});
});

describe('scoreOpenCell', () => {
	it('scores a challenge the team never marked', async () => {
		const outcome = await scoreOpenCell(
			db,
			game.id,
			form({
				teamId: String(rats.id),
				challengeId: String(swim.id),
				points: '10',
				nickname: 'Alex'
			})
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'scored', points: 10 } });
		expect((await listTeamClaims(db, rats.id))[0]).toMatchObject({
			status: 'scored',
			marked_by: 'Alex',
			judged_by: 'Alex'
		});
	});

	it('names the teammate who marked it meanwhile', async () => {
		await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });

		const outcome = await scoreOpenCell(
			db,
			game.id,
			form({
				teamId: String(rats.id),
				challengeId: String(swim.id),
				points: '10',
				nickname: 'Alex'
			})
		);

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Kim already marked this done.' }
		});
	});

	it('refuses a team or challenge that is gone', async () => {
		const outcome = await scoreOpenCell(
			db,
			game.id,
			form({ teamId: '9999', challengeId: String(swim.id), points: '10', nickname: 'Alex' })
		);

		expect(outcome).toEqual({
			status: 404,
			result: {
				kind: 'error',
				message: 'That team or challenge is not in this game any more. Reload the page.'
			}
		});
	});
});

describe('checkJudgement', () => {
	const check = (fields: Record<string, string>) =>
		checkJudgement(db, game.id, form({ nickname: 'Alex', ...fields }));

	it('answers a score that went through as scored', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 20,
			judged_by: 'Alex'
		});

		const outcome = await check({
			verdict: 'scored',
			claimId: String(claim.id),
			from: 'pending',
			points: '99'
		});

		expect(outcome).toEqual({ status: 200, result: { kind: 'scored', points: 20 } });
	});

	it('answers a rejection that went through as rejected', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'rejected', judged_by: 'Alex' });

		const outcome = await check({
			verdict: 'rejected',
			claimId: String(claim.id),
			from: 'pending'
		});

		expect(outcome).toEqual({ status: 200, result: { kind: 'rejected' } });
	});

	it('says a claim still as the judge saw it is unchanged', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const outcome = await check({
			verdict: 'scored',
			claimId: String(claim.id),
			from: 'pending',
			points: '12'
		});

		expect(outcome).toEqual({ status: 200, result: { kind: 'unchanged' } });
	});

	it('names the judge who got there first', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Sam'
		});

		const outcome = await check({
			verdict: 'scored',
			claimId: String(claim.id),
			from: 'pending',
			points: '12'
		});

		expect(outcome).toEqual({
			status: 409,
			result: { kind: 'error', message: 'Sam already scored this: 15 points.' }
		});
	});

	it('names this judge when the claim got another verdict of theirs', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Alex'
		});

		const outcome = await check({
			verdict: 'scored',
			claimId: String(claim.id),
			from: 'pending',
			points: '12'
		});

		expect(outcome.result).toEqual({
			kind: 'error',
			message: 'Alex already scored this: 15 points.'
		});
	});

	it('says a claim that is gone left the game', async () => {
		const outcome = await check({ verdict: 'rejected', claimId: '9999', from: 'pending' });

		expect(outcome.status).toBe(404);
	});

	it('answers an open cell this judge scored as scored', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 5, judged_by: 'Alex' });

		const outcome = await check({
			verdict: 'scored',
			teamId: String(rats.id),
			challengeId: String(swim.id),
			points: '1'
		});

		expect(outcome).toEqual({ status: 200, result: { kind: 'scored', points: 5 } });
	});

	it('says an open cell still open is unchanged', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'rejected', judged_by: 'Sam' });

		const outcome = await check({
			verdict: 'scored',
			teamId: String(rats.id),
			challengeId: String(swim.id),
			points: '8'
		});

		expect(outcome.result).toEqual({ kind: 'unchanged' });
	});

	it('changes nothing', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		await check({ verdict: 'scored', claimId: String(claim.id), from: 'pending', points: '12' });

		expect((await listTeamClaims(db, rats.id))[0]).toMatchObject({ status: 'pending' });
	});
});
