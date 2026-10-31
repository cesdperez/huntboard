import { describe, expect, it } from 'vitest';
import { wordmarkHome } from './wordmark-home.js';

const at = (routeId: string | null, params: Record<string, string> = {}) => ({
	routeId,
	params,
	signedIn: false,
	error: false
});

describe('wordmarkHome', () => {
	it('keeps a player on their team page', () => {
		expect(wordmarkHome(at('/t/[token]', { token: 'team1' }))).toBe('/t/team1');
	});

	it('keeps a spectator on the scoreboard', () => {
		expect(wordmarkHome(at('/s/[token]', { token: 'board1' }))).toBe('/s/board1');
	});

	it('sends a signed-in admin to My games', () => {
		const admin = { ...at('/a/[token]/queue', { token: 'adm1' }), signedIn: true };
		expect(wordmarkHome(admin)).toBe('/games');
	});

	it('sends a signed-out admin to the admin home of the game', () => {
		expect(wordmarkHome(at('/a/[token]/grid', { token: 'adm1' }))).toBe('/a/adm1');
		expect(wordmarkHome(at('/a/[token]', { token: 'adm1' }))).toBe('/a/adm1');
	});

	it('sends pages outside a game to the home page', () => {
		for (const routeId of ['/', '/new', '/games', '/login', null]) {
			expect(wordmarkHome(at(routeId))).toBe('/');
		}
	});

	it('sends an error page to the home page, since its link may be the one that failed', () => {
		const deadTeamLink = { ...at('/t/[token]', { token: 'old' }), error: true };
		expect(wordmarkHome(deadTeamLink)).toBe('/');
	});

	it('does not mistake a route that only starts like a game route', () => {
		expect(wordmarkHome(at('/tour'))).toBe('/');
	});
});
