import { describe, expect, it } from 'vitest';
import {
	forgetDeadLink,
	forgetRecentGame,
	recentGames,
	recordRecentGame,
	type RecentGameLink
} from './recent-games.js';

class FakeStorage {
	items = new Map<string, string>();
	getItem = (key: string) => this.items.get(key) ?? null;
	setItem = (key: string, value: string) => void this.items.set(key, value);
	removeItem = (key: string) => void this.items.delete(key);
}

const team = (path: string, teamName = 'Canal Rats'): RecentGameLink => ({
	kind: 'team',
	path,
	gameName: 'Birthday hunt',
	teamName
});

describe('recent games', () => {
	it('lists what was recorded, newest first', () => {
		const storage = new FakeStorage();

		recordRecentGame(team('/t/one'), { now: 1, storage });
		recordRecentGame(
			{ kind: 'admin', path: '/a/two', gameName: 'Office hunt' },
			{ now: 2, storage }
		);

		expect(recentGames(storage)).toEqual([
			{ kind: 'admin', path: '/a/two', gameName: 'Office hunt', openedAt: 2 },
			{ ...team('/t/one'), openedAt: 1 }
		]);
	});

	it('keeps one entry per path, with its latest names and time', () => {
		const storage = new FakeStorage();
		recordRecentGame(team('/t/one'), { now: 1, storage });
		recordRecentGame(team('/s/two'), { now: 2, storage });

		recordRecentGame(team('/t/one', 'Night Owls'), { now: 3, storage });

		expect(recentGames(storage).map((game) => [game.path, game.teamName, game.openedAt])).toEqual([
			['/t/one', 'Night Owls', 3],
			['/s/two', 'Canal Rats', 2]
		]);
	});

	it('keeps the 10 most recent', () => {
		const storage = new FakeStorage();
		for (let index = 1; index <= 12; index++) {
			recordRecentGame(team(`/t/${index}`), { now: index, storage });
		}

		const paths = recentGames(storage).map((game) => game.path);
		expect(paths).toHaveLength(10);
		expect(paths[0]).toBe('/t/12');
		expect(paths.at(-1)).toBe('/t/3');
	});

	it('replaces the path a rotated link had', () => {
		const storage = new FakeStorage();
		recordRecentGame(
			{ kind: 'admin', path: '/a/old', gameName: 'Office hunt' },
			{ now: 1, storage }
		);

		recordRecentGame(
			{ kind: 'admin', path: '/a/new', gameName: 'Office hunt' },
			{ replaces: '/a/old', now: 2, storage }
		);

		expect(recentGames(storage).map((game) => game.path)).toEqual(['/a/new']);
	});

	it('forgets one entry by its path', () => {
		const storage = new FakeStorage();
		recordRecentGame(team('/t/one'), { now: 1, storage });
		recordRecentGame(team('/t/two'), { now: 2, storage });

		forgetRecentGame('/t/one', storage);

		expect(recentGames(storage).map((game) => game.path)).toEqual(['/t/two']);
	});

	it('forgets a dead link, a page under it included', () => {
		const storage = new FakeStorage();
		recordRecentGame(
			{ kind: 'admin', path: '/a/abc', gameName: 'Office hunt' },
			{ now: 1, storage }
		);
		recordRecentGame(team('/t/abcdef'), { now: 2, storage });
		recordRecentGame(team('/t/xyz'), { now: 3, storage });

		forgetDeadLink('/a/abc/setup', storage);
		forgetDeadLink('/t/xyz', storage);

		expect(recentGames(storage).map((game) => game.path)).toEqual(['/t/abcdef']);
	});

	it('skips stored entries it cannot read', () => {
		const storage = new FakeStorage();
		storage.setItem(
			'huntboard.recent-games',
			JSON.stringify([
				{ kind: 'team', path: '/t/one', gameName: 'Hunt', teamName: 'Rats', openedAt: 1 },
				{ kind: 'judge', path: '/j/two', gameName: 'Hunt', openedAt: 2 },
				{ kind: 'admin', path: 3, gameName: 'Hunt', openedAt: 3 },
				'nonsense'
			])
		);

		expect(recentGames(storage).map((game) => game.path)).toEqual(['/t/one']);
	});

	it('reads as empty from unreadable JSON', () => {
		const storage = new FakeStorage();
		storage.setItem('huntboard.recent-games', '{not json');

		expect(recentGames(storage)).toEqual([]);
	});

	it('reads as empty where the browser refuses storage', () => {
		const storage = {
			getItem: () => {
				throw new DOMException('denied', 'SecurityError');
			},
			setItem: () => {
				throw new DOMException('full', 'QuotaExceededError');
			},
			removeItem: () => {}
		};

		expect(() => recordRecentGame(team('/t/one'), { storage })).not.toThrow();
		expect(() => forgetDeadLink('/t/one', storage)).not.toThrow();
		expect(recentGames(storage)).toEqual([]);
		expect(recentGames(null)).toEqual([]);
	});
});
