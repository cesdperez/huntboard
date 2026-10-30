import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newAdminToken, rememberNewAdminToken } from '#lib/client/new-admin-link.js';
import { AdminLinkRotation } from './admin-link-rotation.svelte.js';

class FakeStorage {
	items = new Map<string, string>();
	getItem = (key: string) => this.items.get(key) ?? null;
	setItem = (key: string, value: string) => void this.items.set(key, value);
	removeItem = (key: string) => void this.items.delete(key);
}

let working: string[];
let moveTo: ReturnType<typeof vi.fn<(token: string) => Promise<void>>>;
let rotation: AdminLinkRotation;

beforeEach(() => {
	vi.stubGlobal('sessionStorage', new FakeStorage());
	working = ['old'];
	moveTo = vi.fn(async () => {});
	rotation = new AdminLinkRotation(
		() => 'old',
		async (token) => working.includes(token),
		moveTo
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AdminLinkRotation', () => {
	it('keeps the token it sends in the tab, under the link it replaces', () => {
		const token = rotation.begin();

		expect(newAdminToken('old')).toBe(token);
	});

	it('sends an unconfirmed token again instead of making a second one', () => {
		const first = rotation.begin();

		expect(rotation.begin()).toBe(first);
	});

	it('stays unsure, holding the new token, while neither link answers', async () => {
		const token = rotation.begin();
		working = [];

		expect(await rotation.recheck()).toBe('unknown');

		expect(rotation.unsure).toBe(true);
		expect(rotation.pending).toBe(token);
		expect(newAdminToken('old')).toBe(token);
	});

	it('moves to the new link once it works, and forgets it', async () => {
		const token = rotation.begin();
		working = [token];

		expect(await rotation.recheck()).toBe('moved');

		expect(moveTo).toHaveBeenCalledWith(token);
		expect(rotation.unsure).toBe(false);
		expect(newAdminToken('old')).toBeNull();
	});

	it('forgets the token when the old link still works', async () => {
		rotation.begin();

		expect(await rotation.recheck()).toBe('kept');

		expect(moveTo).not.toHaveBeenCalled();
		expect(rotation.pending).toBeNull();
		expect(newAdminToken('old')).toBeNull();
	});

	it('picks up a token an earlier visit left unsure, and checks it', async () => {
		rememberNewAdminToken('old', 'new');
		working = [];

		await rotation.restore();

		expect(rotation.pending).toBe('new');
		expect(rotation.unsure).toBe(true);
	});

	it('has nothing to offer on a link that never rotated', async () => {
		await rotation.restore();

		expect(rotation.pending).toBeNull();
		expect(rotation.unsure).toBe(false);
	});
});
