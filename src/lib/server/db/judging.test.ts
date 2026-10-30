import { beforeEach, describe, expect, it } from 'vitest';
import { listTeamClaims } from './claims.js';
import { createGame } from './games.js';
import {
	countPendingClaims,
	judgeClaim,
	listGameClaims,
	listPendingClaims,
	scoreWithoutClaim
} from './judging.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from './types.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;
let swim: ChallengeRow;
let cake: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
	swim = await seedChallenge(db, game.id, {
		title: 'Swim in a fountain',
		min_points: 5,
		max_points: 20
	});
	cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
});

async function otherGameClaim() {
	const other = await createGame(db, 'Other hunt');
	const team = await seedTeam(db, other.id);
	return seedClaim(db, team.id, (await seedChallenge(db, other.id)).id);
}

describe('listPendingClaims', () => {
	it('lists pending claims of this game oldest first, with team and challenge', async () => {
		await seedClaim(db, rats.id, swim.id, { marked_at: '2026-06-01T17:10:00.000Z', note: 'late' });
		await seedClaim(db, owls.id, cake.id, { marked_at: '2026-06-01T17:02:00.000Z' });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 8 });
		await seedClaim(db, rats.id, cake.id, { status: 'rejected' });
		await otherGameClaim();

		const queue = await listPendingClaims(db, game.id);

		expect(queue).toEqual([
			expect.objectContaining({
				team_name: 'Night Owls',
				challenge_title: 'Bake a cake',
				marked_at: '2026-06-01T17:02:00.000Z'
			}),
			expect.objectContaining({
				team_id: rats.id,
				team_name: 'Canal Rats',
				challenge_id: swim.id,
				challenge_title: 'Swim in a fountain',
				min_points: 5,
				max_points: 20,
				note: 'late',
				marked_by: 'Sam',
				status: 'pending'
			})
		]);
	});

	it('carries the latest earlier rejection of the same team and challenge', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'rejected', judge_note: 'Blurry' });
		await seedClaim(db, rats.id, swim.id, {
			status: 'rejected',
			judged_by: 'Alex',
			judge_note: 'Still blurry'
		});
		await seedClaim(db, owls.id, swim.id, { status: 'rejected', judge_note: 'Owl reason' });
		await seedClaim(db, rats.id, swim.id);
		await seedClaim(db, rats.id, cake.id);

		const queue = await listPendingClaims(db, game.id);

		expect(queue.map((claim) => [claim.rejected_count, claim.last_rejection_note])).toEqual([
			[2, 'Still blurry'],
			[0, null]
		]);
	});
});

describe('countPendingClaims', () => {
	it('counts pending claims of this game only', async () => {
		await seedClaim(db, rats.id, swim.id);
		await seedClaim(db, owls.id, swim.id);
		await seedClaim(db, owls.id, cake.id, { status: 'scored', points: 5 });
		await otherGameClaim();

		expect(await countPendingClaims(db, game.id)).toBe(2);
	});
});

describe('listGameClaims', () => {
	it('lists every claim of this game, oldest first', async () => {
		const first = await seedClaim(db, rats.id, swim.id, { status: 'rejected' });
		const second = await seedClaim(db, owls.id, cake.id);
		await otherGameClaim();

		const claims = await listGameClaims(db, game.id);

		expect(claims.map((claim) => claim.id)).toEqual([first.id, second.id]);
	});
});

describe('judgeClaim', () => {
	it('scores a pending claim and records the judge', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'pending',
			verdict: { status: 'scored', points: 12 },
			judgedBy: 'Alex'
		});

		expect(result).toEqual({
			status: 'judged',
			claim: expect.objectContaining({
				id: claim.id,
				status: 'scored',
				points: 12,
				judged_by: 'Alex',
				judge_note: null,
				judged_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
			})
		});
	});

	it.each([
		[99, 20],
		[-4, 5]
	])('clamps %i points into the challenge range as %i', async (points, clamped) => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'pending',
			verdict: { status: 'scored', points },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({ status: 'judged', claim: { points: clamped } });
	});

	it('rejects a pending claim with a reason', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'pending',
			verdict: { status: 'rejected', reason: 'No proof received' },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({
			status: 'judged',
			claim: {
				status: 'rejected',
				points: null,
				judge_note: 'No proof received',
				judged_by: 'Alex'
			}
		});
	});

	it('refuses to judge a pending claim twice and returns how it was judged', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Sam'
		});

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'pending',
			verdict: { status: 'rejected', reason: null },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({
			status: 'conflict',
			claim: { status: 'scored', points: 15, judged_by: 'Sam' }
		});
	});

	it('fixes the points of a scored claim, last write wins', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Sam'
		});

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'scored',
			verdict: { status: 'scored', points: 8 },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({ status: 'judged', claim: { points: 8, judged_by: 'Alex' } });
	});

	it('rejects a scored claim, so the team may claim it again', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 15 });

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'scored',
			verdict: { status: 'rejected', reason: null },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({ status: 'judged', claim: { status: 'rejected', points: null } });
	});

	it('refuses to fix a scored claim another judge rejected meanwhile', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'rejected', judged_by: 'Sam' });

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'scored',
			verdict: { status: 'scored', points: 8 },
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({ status: 'conflict', claim: { status: 'rejected' } });
	});

	it('reports a claim the team undid', async () => {
		const result = await judgeClaim(db, game.id, {
			claimId: 9999,
			from: 'pending',
			verdict: { status: 'scored', points: 8 },
			judgedBy: 'Alex'
		});

		expect(result).toEqual({ status: 'not-found' });
	});

	it('does not touch a claim of another game', async () => {
		const claim = await otherGameClaim();

		const result = await judgeClaim(db, game.id, {
			claimId: claim.id,
			from: 'pending',
			verdict: { status: 'scored', points: 8 },
			judgedBy: 'Alex'
		});

		expect(result).toEqual({ status: 'not-found' });
	});
});

describe('scoreWithoutClaim', () => {
	it('adds a scored claim marked and judged by the admin, clamped', async () => {
		const result = await scoreWithoutClaim(db, game.id, {
			teamId: rats.id,
			challengeId: swim.id,
			points: 50,
			judgedBy: 'Alex'
		});

		expect(result).toEqual({
			status: 'judged',
			claim: expect.objectContaining({
				team_id: rats.id,
				challenge_id: swim.id,
				status: 'scored',
				points: 20,
				marked_by: 'Alex',
				judged_by: 'Alex',
				judged_at: expect.any(String)
			})
		});
	});

	it('scores again after a rejection, keeping the rejection as history', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'rejected' });

		const result = await scoreWithoutClaim(db, game.id, {
			teamId: rats.id,
			challengeId: swim.id,
			points: 10,
			judgedBy: 'Alex'
		});

		expect(result.status).toBe('judged');
		expect((await listTeamClaims(db, rats.id)).map((claim) => claim.status)).toEqual([
			'rejected',
			'scored'
		]);
	});

	it('returns the active claim the team made meanwhile', async () => {
		await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });

		const result = await scoreWithoutClaim(db, game.id, {
			teamId: rats.id,
			challengeId: swim.id,
			points: 10,
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({
			status: 'conflict',
			claim: { status: 'pending', marked_by: 'Kim' }
		});
	});

	it('refuses a team or challenge of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const outsider = await seedTeam(db, other.id);
		const elsewhere = await seedChallenge(db, other.id);

		const score = (teamId: number, challengeId: number) =>
			scoreWithoutClaim(db, game.id, { teamId, challengeId, points: 10, judgedBy: 'Alex' });

		expect(await score(outsider.id, swim.id)).toEqual({ status: 'not-found' });
		expect(await score(rats.id, elsewhere.id)).toEqual({ status: 'not-found' });
	});

	it('never takes the id of an undone claim, which a judge page not yet refreshed may still send', async () => {
		const undone = await seedClaim(db, owls.id, cake.id);
		await db.prepare('DELETE FROM claim WHERE id = ?').bind(undone.id).run();

		const result = await scoreWithoutClaim(db, game.id, {
			teamId: rats.id,
			challengeId: swim.id,
			points: 10,
			judgedBy: 'Alex'
		});

		expect(result).toMatchObject({ status: 'judged', claim: { id: undone.id + 1 } });
	});
});
