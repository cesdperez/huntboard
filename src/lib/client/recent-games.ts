// Players have no account, so this browser remembers the game links it opened, to find them again
// from the home page or a dead link page. It keeps only what those pages already show.

import { browserStorage, type BrowserStorage } from './browser-storage.js';

export type RecentGameKind = 'team' | 'admin' | 'scoreboard';

export interface RecentGameLink {
	kind: RecentGameKind;
	path: string;
	gameName: string;
	teamName?: string;
}

export interface RecentGame extends RecentGameLink {
	openedAt: number;
}

const STORAGE_KEY = 'huntboard.recent-games';
const LIMIT = 10;
const KINDS: readonly string[] = ['team', 'admin', 'scoreboard'] satisfies RecentGameKind[];

/** The game links this browser opened, newest first. */
export function recentGames(storage = browserStorage()): RecentGame[] {
	try {
		const stored: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(stored) ? stored.filter(isRecentGame) : [];
	} catch {
		return [];
	}
}

/** Puts the link first. replaces is the path the same page had before its link was rotated. */
export function recordRecentGame(
	link: RecentGameLink,
	{
		replaces,
		now = Date.now(),
		storage = browserStorage()
	}: { replaces?: string; now?: number; storage?: BrowserStorage | null } = {}
): void {
	const others = recentGames(storage).filter(
		(game) => game.path !== link.path && game.path !== replaces
	);
	save([{ ...link, openedAt: now }, ...others].slice(0, LIMIT), storage);
}

export function forgetRecentGame(path: string, storage = browserStorage()): void {
	save(
		recentGames(storage).filter((game) => game.path !== path),
		storage
	);
}

/** Forgets the link a 404 came from. Admin links are kept by their root, the 404 can be a tab. */
export function forgetDeadLink(pathname: string, storage = browserStorage()): void {
	save(
		recentGames(storage).filter(
			(game) => pathname !== game.path && !pathname.startsWith(`${game.path}/`)
		),
		storage
	);
}

function save(games: RecentGame[], storage: BrowserStorage | null): void {
	try {
		storage?.setItem(STORAGE_KEY, JSON.stringify(games));
	} catch {
		// Storage full or refused: the list just stays as it was.
	}
}

function isRecentGame(value: unknown): value is RecentGame {
	if (typeof value !== 'object' || value === null) return false;
	const game = value as Record<string, unknown>;
	return (
		typeof game.kind === 'string' &&
		KINDS.includes(game.kind) &&
		typeof game.path === 'string' &&
		typeof game.gameName === 'string' &&
		(game.teamName === undefined || typeof game.teamName === 'string') &&
		typeof game.openedAt === 'number'
	);
}
