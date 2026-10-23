import { beforeEach, describe, expect, it } from 'vitest';
import { createGame, updateGameSettings } from '../db/games.js';
import { setGameImage, setTeamAvatar } from '../db/images.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedAdjustment, seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { ChallengeRow, GameRow, TeamRow } from '../db/types.js';
import { findTeamLink, getTeamPage } from './team-page.js';

let db: D1Database;
let game: GameRow;
let rats: TeamRow;
let owls: TeamRow;
let swim: ChallengeRow;
let cake: ChallengeRow;

beforeEach(async () => {
	db = createTestDb();
	game = await updateGameSettings(db, (await createGame(db, 'Canal hunt')).id, {
		name: 'Canal hunt',
		starts_at: '2026-06-01T16:00:00.000Z',
		ends_at: '2026-06-01T21:00:00.000Z',
		late_penalty_per_minute: 1,
		theme: 'flag'
	});
	rats = await seedTeam(db, game.id, { name: 'Canal Rats' });
	owls = await seedTeam(db, game.id, { name: 'Night Owls' });
	swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain', section: 'Water' });
	cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
});

describe('findTeamLink', () => {
	it('finds the team and its game by the team token', async () => {
		expect(await findTeamLink(db, rats.token)).toEqual({ team: rats, game });
	});

	it('returns null for an unknown token', async () => {
		expect(await findTeamLink(db, 'nope')).toBeNull();
	});
});

describe('getTeamPage', () => {
	it('shows the game, the team name and every challenge with this team claim', async () => {
		await seedClaim(db, rats.id, swim.id, { note: 'photo at 17:02' });

		const page = await getTeamPage(db, rats, game);

		expect(page.team).toEqual({ name: 'Canal Rats', members: '', avatarKey: null });
		expect(page.game).toEqual({
			name: 'Canal hunt',
			startsAt: '2026-06-01T16:00:00.000Z',
			endsAt: '2026-06-01T21:00:00.000Z',
			image: null
		});
		expect(page.challenges.map((c) => [c.title, c.section, c.claim?.status ?? 'open'])).toEqual([
			['Swim in a fountain', 'Water', 'pending'],
			['Bake a cake', null, 'open']
		]);
	});

	it('shows the team picture and the game image', async () => {
		await setTeamAvatar(db, game.id, rats.id, `${game.id}/rats.webp`);
		await setGameImage(db, game.id, `${game.id}/poster.webp`, 'Map');
		const link = (await findTeamLink(db, rats.token))!;

		const page = await getTeamPage(db, link.team, link.game);

		expect(page.team.avatarKey).toBe(`${game.id}/rats.webp`);
		expect(page.game.image).toEqual({ src: `/images/${game.id}/poster.webp`, label: 'Map' });
		expect(page.standings.find((row) => row.own)?.avatarKey).toBe(`${game.id}/rats.webp`);
	});

	it('ranks every team by total and marks this team row', async () => {
		await seedClaim(db, owls.id, swim.id, { status: 'scored', points: 9 });
		await seedAdjustment(db, rats.id, { points: 4 });

		const page = await getTeamPage(db, rats, game);

		expect(page.standings).toEqual([
			{
				teamId: owls.id,
				rank: 1,
				name: 'Night Owls',
				members: '',
				avatarKey: null,
				total: 9,
				own: false
			},
			{
				teamId: rats.id,
				rank: 2,
				name: 'Canal Rats',
				members: '',
				avatarKey: null,
				total: 4,
				own: true
			}
		]);
	});

	it('never includes another team claims, notes or names of who marked them', async () => {
		await seedClaim(db, rats.id, cake.id, { note: 'rat note', marked_by: 'Sam' });
		await seedClaim(db, owls.id, swim.id, {
			status: 'scored',
			points: 9,
			note: 'owl secret note',
			marked_by: 'Owl Olga',
			judged_by: 'Judge Owl'
		});
		await seedClaim(db, owls.id, cake.id, { status: 'rejected', judge_note: 'owl rejection' });

		const json = JSON.stringify(await getTeamPage(db, rats, game));

		expect(json).toContain('rat note');
		for (const leak of ['owl secret note', 'Owl Olga', 'Judge Owl', 'owl rejection', owls.token]) {
			expect(json).not.toContain(leak);
		}
	});

	it('does not send the team token or the game tokens', async () => {
		const json = JSON.stringify(await getTeamPage(db, rats, game));

		expect(json).not.toContain(rats.token);
		expect(json).not.toContain(game.admin_token);
		expect(json).not.toContain(game.scoreboard_token);
	});
});
