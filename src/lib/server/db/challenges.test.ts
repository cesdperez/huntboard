import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeFields } from '#lib/domain/challenge-import.js';
import { titleKey } from '#lib/domain/challenge-parser.js';
import {
	applyChallengeImport,
	getImportSource,
	listChallenges,
	listChallengesWithClaimCounts,
	updateChallenge
} from './challenges.js';
import { createGame } from './games.js';
import { createTestDb } from './testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from './testing/seed.js';
import type { GameRow } from './types.js';

let db: D1Database;
let game: GameRow;

beforeEach(async () => {
	db = createTestDb();
	game = await createGame(db, 'Canal hunt');
});

describe('listChallengesWithClaimCounts', () => {
	it('lists only this game challenges in position order', async () => {
		await seedChallenge(db, game.id, { title: 'Second', position: 1 });
		await seedChallenge(db, game.id, { title: 'First', position: 0 });
		const other = await createGame(db, 'Other hunt');
		await seedChallenge(db, other.id, { title: 'Elsewhere' });

		const challenges = await listChallengesWithClaimCounts(db, game.id);

		expect(challenges.map((challenge) => challenge.title)).toEqual(['First', 'Second']);
	});

	it('counts every claim on a challenge across teams, rejected history included', async () => {
		const rats = await seedTeam(db, game.id);
		const owls = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		const cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
		await seedClaim(db, rats.id, swim.id, { status: 'rejected' });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 7 });

		const challenges = await listChallengesWithClaimCounts(db, game.id);

		expect(challenges).toEqual([
			{ ...swim, claim_count: 2 },
			{ ...cake, claim_count: 0 }
		]);
	});
});

describe('listChallenges', () => {
	it('lists only this game challenges in position order, without claim counts', async () => {
		const second = await seedChallenge(db, game.id, { title: 'Second', position: 1 });
		const first = await seedChallenge(db, game.id, { title: 'First', position: 0 });
		const team = await seedTeam(db, game.id);
		await seedClaim(db, team.id, first.id);
		const other = await createGame(db, 'Other hunt');
		await seedChallenge(db, other.id, { title: 'Elsewhere' });

		expect(await listChallenges(db, game.id)).toEqual([first, second]);
	});
});

describe('getImportSource', () => {
	it('lists this game challenges with their claims and the claiming team names', async () => {
		const rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
		const owls = await seedTeam(db, game.id, { name: 'Night Owls' });
		const swim = await seedChallenge(db, game.id, { title: 'Swim' });
		const cake = await seedChallenge(db, game.id, { title: 'Cake' });
		const scored = await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 7 });
		const rejected = await seedClaim(db, owls.id, swim.id, { status: 'rejected' });
		const other = await createGame(db, 'Other hunt');
		await seedChallenge(db, other.id, { title: 'Elsewhere' });

		const source = await getImportSource(db, game.id);

		expect(source.existing).toEqual([
			{
				id: swim.id,
				title: 'Swim',
				claims: [
					{ id: scored.id, team_id: rats.id, status: 'scored', points: 7 },
					{ id: rejected.id, team_id: owls.id, status: 'rejected', points: null }
				]
			},
			{ id: cake.id, title: 'Cake', claims: [] }
		]);
		expect(source.teamNames).toEqual(
			new Map([
				[rats.id, 'Canal Rats'],
				[owls.id, 'Night Owls']
			])
		);
	});
});

describe('applyChallengeImport', () => {
	function fields(title: string, overrides: Partial<ChallengeFields> = {}): ChallengeFields {
		return {
			title,
			title_key: titleKey(title),
			description: null,
			section: null,
			min_points: 5,
			max_points: 10,
			position: 0,
			...overrides
		};
	}

	it('inserts, updates and deletes in one go, deleting claims of removed challenges', async () => {
		const rats = await seedTeam(db, game.id);
		const keep = await seedChallenge(db, game.id, { title: 'Keep' });
		const drop = await seedChallenge(db, game.id, { title: 'Drop' });
		await seedClaim(db, rats.id, drop.id, { status: 'pending' });

		const result = await applyChallengeImport(db, game.id, {
			inserts: [fields('New one', { position: 0, section: 'Food' })],
			updates: [{ id: keep.id, ...fields('KEEP', { position: 1, min_points: 1, max_points: 3 }) }],
			deleteIds: [],
			deleteWithClaimsIds: [drop.id]
		});

		expect(result).toEqual({ status: 'applied' });
		const challenges = await listChallengesWithClaimCounts(db, game.id);
		expect(
			challenges.map(({ title, section, min_points, max_points }) => ({
				title,
				section,
				min_points,
				max_points
			}))
		).toEqual([
			{ title: 'New one', section: 'Food', min_points: 5, max_points: 10 },
			{ title: 'KEEP', section: null, min_points: 1, max_points: 3 }
		]);
		expect(await db.prepare('SELECT count(*) AS n FROM claim').first('n')).toBe(0);
	});

	it('clamps scored claims of updated challenges into the new range', async () => {
		const rats = await seedTeam(db, game.id);
		const owls = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim', min_points: 0, max_points: 50 });
		const high = await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 40 });
		const low = await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 2 });

		await applyChallengeImport(db, game.id, {
			inserts: [],
			updates: [{ id: swim.id, ...fields('Swim', { min_points: 10, max_points: 30 }) }],
			deleteIds: [],
			deleteWithClaimsIds: []
		});

		expect(await claimPoints(high.id)).toBe(30);
		expect(await claimPoints(low.id)).toBe(10);
	});

	it('keeps a challenge that got a claim after it was planned as an unclaimed delete', async () => {
		const rats = await seedTeam(db, game.id);
		const late = await seedChallenge(db, game.id, { title: 'Late claim' });
		await seedClaim(db, rats.id, late.id, { status: 'pending' });

		await applyChallengeImport(db, game.id, {
			inserts: [],
			updates: [],
			deleteIds: [late.id],
			deleteWithClaimsIds: []
		});

		expect(await listChallengesWithClaimCounts(db, game.id)).toEqual([{ ...late, claim_count: 1 }]);
	});

	it('reports a conflict and writes nothing when a title was taken since the preview', async () => {
		const keep = await seedChallenge(db, game.id, { title: 'Keep' });
		const taken = await seedChallenge(db, game.id, { title: 'Taken' });

		const result = await applyChallengeImport(db, game.id, {
			inserts: [fields('TAKEN', { position: 1 })],
			updates: [{ id: keep.id, ...fields('Kept', { position: 0 }) }],
			deleteIds: [],
			deleteWithClaimsIds: []
		});

		expect(result).toEqual({ status: 'conflict' });
		expect(await listChallengesWithClaimCounts(db, game.id)).toEqual([
			{ ...keep, claim_count: 0 },
			{ ...taken, claim_count: 0 }
		]);
	});

	it('leaves challenges of other games alone', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedChallenge(db, other.id, { title: 'Elsewhere' });

		await applyChallengeImport(db, game.id, {
			inserts: [],
			updates: [{ id: elsewhere.id, ...fields('Hijacked') }],
			deleteIds: [elsewhere.id],
			deleteWithClaimsIds: [elsewhere.id]
		});

		expect(await listChallengesWithClaimCounts(db, other.id)).toEqual([
			{ ...elsewhere, claim_count: 0 }
		]);
	});
});

describe('updateChallenge', () => {
	const edit = {
		title: 'Swim in a Fountain',
		title_key: 'swim in a fountain',
		description: 'Wet',
		section: 'Around town',
		min_points: 10,
		max_points: 20
	};

	it('updates the fields and clamps scored claims, reporting how many moved', async () => {
		const rats = await seedTeam(db, game.id);
		const owls = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim', max_points: 50, position: 3 });
		const high = await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 40 });
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 15 });

		const result = await updateChallenge(db, game.id, swim.id, edit);

		expect(result).toEqual({ status: 'updated', clampedCount: 1 });
		const [stored] = await listChallengesWithClaimCounts(db, game.id);
		expect(stored).toEqual({ ...swim, ...edit, claim_count: 2 });
		expect(await claimPoints(high.id)).toBe(20);
	});

	it('refuses a title another challenge of the game already uses', async () => {
		const swim = await seedChallenge(db, game.id, { title: 'Swim' });
		await seedChallenge(db, game.id, { title: 'Swim in a fountain' });

		expect(await updateChallenge(db, game.id, swim.id, edit)).toEqual({
			status: 'duplicate-title'
		});
	});

	it('allows changing only the case of its own title', async () => {
		const swim = await seedChallenge(db, game.id, { title: 'swim in a fountain' });

		expect(await updateChallenge(db, game.id, swim.id, edit)).toMatchObject({ status: 'updated' });
	});

	it('does not touch a challenge of another game', async () => {
		const other = await createGame(db, 'Other hunt');
		const elsewhere = await seedChallenge(db, other.id, { title: 'Elsewhere' });

		expect(await updateChallenge(db, game.id, elsewhere.id, edit)).toEqual({ status: 'not-found' });
		expect((await listChallengesWithClaimCounts(db, other.id))[0].title).toBe('Elsewhere');
	});
});

function claimPoints(claimId: number): Promise<number | null> {
	return db.prepare('SELECT points FROM claim WHERE id = ?').bind(claimId).first<number>('points');
}
