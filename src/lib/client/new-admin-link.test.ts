import { describe, expect, it, vi } from 'vitest';
import {
	checkRotation,
	forgetNewAdminToken,
	newAdminToken,
	rememberNewAdminToken
} from './new-admin-link.js';

class FakeStorage {
	items = new Map<string, string>();
	getItem = (key: string) => this.items.get(key) ?? null;
	setItem = (key: string, value: string) => void this.items.set(key, value);
	removeItem = (key: string) => void this.items.delete(key);
}

describe('the new admin token kept in the tab', () => {
	it('is found by the admin token it replaces', () => {
		const storage = new FakeStorage();

		rememberNewAdminToken('old', 'new', storage);

		expect(newAdminToken('old', storage)).toBe('new');
		expect(newAdminToken('other', storage)).toBeNull();
	});

	it('is gone once forgotten', () => {
		const storage = new FakeStorage();
		rememberNewAdminToken('old', 'new', storage);

		forgetNewAdminToken('old', storage);

		expect(newAdminToken('old', storage)).toBeNull();
	});

	it('reads as none where the browser refuses storage', () => {
		const storage = {
			getItem: () => {
				throw new DOMException('denied', 'SecurityError');
			},
			setItem: () => {
				throw new DOMException('full', 'QuotaExceededError');
			},
			removeItem: () => {}
		};

		expect(() => rememberNewAdminToken('old', 'new', storage)).not.toThrow();
		expect(newAdminToken('old', storage)).toBeNull();
	});
});

describe('checkRotation', () => {
	const opening = (working: string[]) => vi.fn(async (token: string) => working.includes(token));

	it('is moved when the new link opens', async () => {
		expect(await checkRotation('old', 'new', opening(['new']))).toBe('moved');
	});

	it('is kept when the old link still opens', async () => {
		expect(await checkRotation('old', 'new', opening(['old']))).toBe('kept');
	});

	it('is unknown when neither link answers', async () => {
		expect(await checkRotation('old', 'new', opening([]))).toBe('unknown');
	});
});
