import { describe, expect, it } from 'vitest';
import type { ChallengeRow, GameRow, TeamRow } from '#lib/server/db/types.js';
import {
	challengeSaved,
	challengesImported,
	gameImageSaved,
	gameIsBlank,
	gameSettingsSaved,
	teamAdded,
	teamDeleted,
	teamMoved,
	teamPictureRemoved,
	teamSaved
} from './setup-checks.js';

function form(fields: Record<string, string | File>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

const game: GameRow = {
	id: 1,
	name: 'Canal hunt',
	admin_token: 'admin',
	scoreboard_token: 'board',
	starts_at: '2026-10-30T18:00:00.000Z',
	ends_at: '2026-10-30T21:00:00.000Z',
	late_penalty_per_minute: 2,
	theme: 'highland-bru',
	created_at: '2026-10-01T00:00:00.000Z',
	image_key: null,
	image_label: '',
	owner_user_id: null
};

function team(id: number, name: string, extra: Partial<TeamRow> = {}): TeamRow {
	return {
		id,
		game_id: 1,
		name,
		name_key: name.toLowerCase(),
		members: '',
		token: `token-${id}`,
		position: id,
		arrived_at: null,
		avatar_key: null,
		...extra
	};
}

function challenge(id: number, title: string, extra: Partial<ChallengeRow> = {}): ChallengeRow {
	return {
		id,
		game_id: 1,
		title,
		title_key: title.toLowerCase(),
		description: null,
		section: null,
		min_points: 10,
		max_points: 10,
		position: id,
		...extra
	};
}

describe('gameSettingsSaved', () => {
	const sent = {
		name: ' Canal hunt ',
		starts_at: '2026-10-30T18:00:00.000Z',
		ends_at: '2026-10-30T21:00:00.000Z',
		late_penalty_per_minute: '2',
		theme: 'highland-bru'
	};

	it('is true when the game holds what the form sent', () => {
		expect(gameSettingsSaved(game, form(sent))).toBe(true);
	});

	it.each([
		['name', 'Pier hunt'],
		['starts_at', ''],
		['ends_at', '2026-10-30T22:00:00.000Z'],
		['late_penalty_per_minute', '3'],
		['theme', 'lightmile-azulejo']
	])('is false when %s differs', (key, value) => {
		expect(gameSettingsSaved(game, form({ ...sent, [key]: value }))).toBe(false);
	});

	it('ignores times the form did not send', () => {
		const withoutTimes = form(sent);
		withoutTimes.delete('starts_at');
		withoutTimes.delete('ends_at');

		expect(gameSettingsSaved({ ...game, starts_at: null }, withoutTimes)).toBe(true);
	});
});

describe('gameImageSaved', () => {
	const shown = { ...game, image_key: 'games/1/a.webp', image_label: 'Map' };

	it('is true for a new label on the same image', () => {
		expect(gameImageSaved(shown, shown, form({ label: '  Map ' }))).toBe(true);
	});

	it('is true for a new image with its label', () => {
		const after = { ...shown, image_key: 'games/1/b.webp' };
		const image = new File(['x'], 'map.webp');

		expect(gameImageSaved(shown, after, form({ image, label: 'Map' }))).toBe(true);
	});

	it('is false while the image is still the old one', () => {
		const image = new File(['x'], 'map.webp');

		expect(gameImageSaved(shown, shown, form({ image, label: 'Map' }))).toBe(false);
	});

	it('is false while the label is still the old one', () => {
		expect(gameImageSaved(shown, shown, form({ label: 'Invitation' }))).toBe(false);
	});
});

describe('teamAdded', () => {
	const rats = team(1, 'Canal Rats');

	it('is true when a team with the sent name and members appeared', () => {
		const after = [rats, team(2, 'Pier Gulls', { members: 'Ann, Bo' })];

		expect(teamAdded([rats], after, form({ name: ' Pier  Gulls', members: 'Ann,  Bo' }))).toBe(
			true
		);
	});

	it('is false when the team was there before', () => {
		const gulls = team(2, 'Pier Gulls');

		expect(teamAdded([rats, gulls], [rats, gulls], form({ name: 'Pier Gulls' }))).toBe(false);
	});

	it('is false when no such team appeared', () => {
		expect(teamAdded([rats], [rats], form({ name: 'Pier Gulls' }))).toBe(false);
	});
});

describe('teamSaved', () => {
	it('is true when the team has the sent name and members', () => {
		const teams = [team(1, 'Canal Rats', { members: 'Ann' })];

		expect(teamSaved(teams, form({ teamId: '1', name: 'Canal Rats', members: ' Ann ' }))).toBe(
			true
		);
	});

	it('is false while the team has its old name', () => {
		const teams = [team(1, 'Canal Rats')];

		expect(teamSaved(teams, form({ teamId: '1', name: 'Dock Rats', members: '' }))).toBe(false);
	});
});

describe('teamDeleted', () => {
	it('is true once the team is gone', () => {
		expect(teamDeleted([team(2, 'Pier Gulls')], form({ teamId: '1' }))).toBe(true);
	});

	it('is false while the team is listed', () => {
		expect(teamDeleted([team(1, 'Canal Rats')], form({ teamId: '1' }))).toBe(false);
	});
});

describe('teamPictureRemoved', () => {
	it('is true once the team has no picture', () => {
		expect(teamPictureRemoved([team(1, 'Canal Rats')], form({ teamId: '1' }))).toBe(true);
	});

	it('is false while it still has one', () => {
		const teams = [team(1, 'Canal Rats', { avatar_key: 'teams/1.webp' })];

		expect(teamPictureRemoved(teams, form({ teamId: '1' }))).toBe(false);
	});
});

describe('teamMoved', () => {
	const [a, b, c] = [team(1, 'A'), team(2, 'B'), team(3, 'C')];

	it('is true when the team moved one place', () => {
		expect(teamMoved([a, b, c], [b, a, c], form({ teamId: '1' }), 1)).toBe(true);
		expect(teamMoved([a, b, c], [a, c, b], form({ teamId: '3' }), -1)).toBe(true);
	});

	it('is false while the team is where it was', () => {
		expect(teamMoved([a, b, c], [a, b, c], form({ teamId: '1' }), 1)).toBe(false);
	});
});

describe('challengeSaved', () => {
	const sent = {
		id: '1',
		title: 'Swim',
		section: 'Water',
		min: '5',
		max: '20',
		description: 'Cold'
	};

	it('is true when the challenge holds what the form sent', () => {
		const challenges = [
			challenge(1, 'Swim', { section: 'Water', min_points: 5, max_points: 20, description: 'Cold' })
		];

		expect(challengeSaved(challenges, form(sent))).toBe(true);
	});

	it('is false while it holds the old points', () => {
		const challenges = [challenge(1, 'Swim', { section: 'Water', description: 'Cold' })];

		expect(challengeSaved(challenges, form(sent))).toBe(false);
	});
});

describe('challengesImported', () => {
	const text = '# Water\n\n- Swim [5-20]\n  Cold\n- Dive [10]';

	it('is true when the list matches what was imported, in order', () => {
		const challenges = [
			challenge(1, 'Swim', {
				section: 'Water',
				min_points: 5,
				max_points: 20,
				description: 'Cold'
			}),
			challenge(2, 'Dive', { section: 'Water' })
		];

		expect(challengesImported(challenges, form({ text }))).toBe(true);
	});

	it('is false while the list is the old one', () => {
		expect(challengesImported([challenge(1, 'Swim')], form({ text }))).toBe(false);
	});
});

describe('gameIsBlank', () => {
	const blank = { ...game, starts_at: null, ends_at: null, late_penalty_per_minute: 0 };

	it('is true for a game without teams, challenges, times or image', () => {
		expect(gameIsBlank(blank, 0, 0)).toBe(true);
	});

	it.each([
		['a team', blank, 1, 0],
		['a challenge', blank, 0, 1],
		['a start time', { ...blank, starts_at: game.starts_at }, 0, 0],
		['a late penalty', { ...blank, late_penalty_per_minute: 2 }, 0, 0],
		['an image', { ...blank, image_key: 'games/1/a.webp' }, 0, 0]
	])('is false with %s', (_case, shown, teams, challenges) => {
		expect(gameIsBlank(shown, teams, challenges)).toBe(false);
	});
});
