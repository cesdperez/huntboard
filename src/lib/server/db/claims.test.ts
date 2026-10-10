import { beforeEach, describe, expect, it } from 'vitest';
import { listTeamClaims, markClaim, undoClaim } from './claims.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from './types.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;
let swim: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
	swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
});

function mark(teamId: number, challengeId: number, note: string | null = null) {
	return markClaim(db, { gameId: game.id, teamId, challengeId, note, markedBy: 'Sam' });
}

describe('listTeamClaims', () => {
	it('lists every claim of one team, rejected history included, oldest first', async () => {
		const cake = await seedChallenge(db, game.id);
		const first = await seedClaim(db, rats.id, swim.id, { status: 'rejected' });
		const second = await seedClaim(db, rats.id, swim.id, { status: 'pending' });
		const third = await seedClaim(db, rats.id, cake.id, { status: 'scored', points: 10 });
		await seedClaim(db, owls.id, swim.id, { status: 'pending', note: 'owl note' });

		const claims = await listTeamClaims(db, rats.id);

		expect(claims.map((claim) => claim.id)).toEqual([first.id, second.id, third.id]);
	});
});

describe('markClaim', () => {
	it('adds a pending claim with the note and who marked it', async () => {
		const result = await mark(rats.id, swim.id, 'photo at 17:02');

		expect(result).toEqual({
			status: 'marked',
			claim: expect.objectContaining({
				team_id: rats.id,
				challenge_id: swim.id,
				status: 'pending',
				note: 'photo at 17:02',
				marked_by: 'Sam',
				points: null
			})
		});
		expect(await listTeamClaims(db, rats.id)).toHaveLength(1);
	});

	it('refuses a second active claim and returns the one already there', async () => {
		const existing = await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });

		const result = await mark(rats.id, swim.id);

		expect(result).toEqual({
			status: 'conflict',
			claim: expect.objectContaining({ id: existing.id, marked_by: 'Kim' })
		});
		expect(await listTeamClaims(db, rats.id)).toHaveLength(1);
	});

	it('refuses a claim on a challenge that is already scored', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 8, judged_by: 'Alex' });

		const result = await mark(rats.id, swim.id);

		expect(result).toMatchObject({
			status: 'conflict',
			claim: { status: 'scored', judged_by: 'Alex' }
		});
	});

	it('claims again after a rejection, keeping the rejection as history', async () => {
		await seedClaim(db, rats.id, swim.id, { status: 'rejected' });

		const result = await mark(rats.id, swim.id);

		expect(result.status).toBe('marked');
		expect((await listTeamClaims(db, rats.id)).map((claim) => claim.status)).toEqual([
			'rejected',
			'pending'
		]);
	});

	it('lets another team claim the same challenge', async () => {
		await seedClaim(db, owls.id, swim.id);

		expect((await mark(rats.id, swim.id)).status).toBe('marked');
	});

	it('refuses a challenge of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedChallenge(db, other.id);

		expect(await mark(rats.id, elsewhere.id)).toEqual({ status: 'not-found' });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses a challenge that does not exist', async () => {
		expect(await mark(rats.id, 9999)).toEqual({ status: 'not-found' });
	});

	it('returns the claim it ran into even when another request removes it right after', async () => {
		const existing = await seedClaim(db, rats.id, swim.id, { marked_by: 'Kim' });
		const racing = afterEachStatement(db, () =>
			db.prepare('DELETE FROM claim WHERE id = ?').bind(existing.id).run()
		);

		const result = await markClaim(racing, {
			gameId: game.id,
			teamId: rats.id,
			challengeId: swim.id,
			note: null,
			markedBy: 'Sam'
		});

		expect(result).toEqual({
			status: 'conflict',
			claim: expect.objectContaining({ id: existing.id, marked_by: 'Kim' })
		});
	});
});

/** Runs `change` after every statement that runs on its own, as a concurrent request could. A batch runs as one. */
function afterEachStatement(db: D1Database, change: () => Promise<unknown>): D1Database {
	const hook = (statement: D1PreparedStatement): D1PreparedStatement =>
		new Proxy(statement, {
			get(target, key) {
				const value = Reflect.get(target, key) as unknown;
				if (key === 'bind') return (...values: unknown[]) => hook(target.bind(...values));
				if (key === 'first' || key === 'all' || key === 'run') {
					return async (...args: unknown[]) => {
						const result = await (value as (...args: unknown[]) => Promise<unknown>).apply(
							target,
							args
						);
						await change();
						return result;
					};
				}
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
	return new Proxy(db, {
		get(target, key) {
			if (key === 'prepare') return (sql: string) => hook(target.prepare(sql));
			return Reflect.get(target, key);
		}
	});
}

describe('undoClaim', () => {
	it('removes a pending claim of the team', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);

		expect(await undoClaim(db, rats.id, claim.id)).toEqual({ status: 'undone' });
		expect(await listTeamClaims(db, rats.id)).toEqual([]);
	});

	it('refuses a claim a judge already scored, and says who', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, {
			status: 'scored',
			points: 15,
			judged_by: 'Alex'
		});

		expect(await undoClaim(db, rats.id, claim.id)).toMatchObject({
			status: 'conflict',
			claim: { id: claim.id, status: 'scored', points: 15, judged_by: 'Alex' }
		});
		expect(await listTeamClaims(db, rats.id)).toHaveLength(1);
	});

	it('refuses a rejected claim', async () => {
		const claim = await seedClaim(db, rats.id, swim.id, { status: 'rejected' });

		expect((await undoClaim(db, rats.id, claim.id)).status).toBe('conflict');
	});

	it('does not touch another team claim', async () => {
		const claim = await seedClaim(db, owls.id, swim.id);

		expect(await undoClaim(db, rats.id, claim.id)).toEqual({ status: 'not-found' });
		expect(await listTeamClaims(db, owls.id)).toHaveLength(1);
	});

	it('reports a claim that is already gone', async () => {
		const claim = await seedClaim(db, rats.id, swim.id);
		await undoClaim(db, rats.id, claim.id);

		expect(await undoClaim(db, rats.id, claim.id)).toEqual({ status: 'not-found' });
	});
});
