import { describe, expect, it } from 'vitest';
import { dismissTeamWelcome, teamWelcomeDismissed } from './team-welcome.js';

class FakeStorage {
	items = new Map<string, string>();
	getItem = (key: string) => this.items.get(key) ?? null;
	setItem = (key: string, value: string) => void this.items.set(key, value);
}

describe('the team welcome', () => {
	it('stays dismissed for the team that dismissed it only', () => {
		const storage = new FakeStorage();

		dismissTeamWelcome('one', storage);

		expect(teamWelcomeDismissed('one', storage)).toBe(true);
		expect(teamWelcomeDismissed('two', storage)).toBe(false);
	});

	it('reads as dismissed where the browser refuses storage', () => {
		const storage = {
			getItem: () => {
				throw new DOMException('denied', 'SecurityError');
			},
			setItem: () => {
				throw new DOMException('full', 'QuotaExceededError');
			}
		};

		expect(() => dismissTeamWelcome('one', storage)).not.toThrow();
		expect(teamWelcomeDismissed('one', storage)).toBe(true);
	});
});
