import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	db: {},
	createNewGame: vi.fn(),
	requireUser: vi.fn()
}));

vi.mock('#lib/server/use-cases/new-game.js', () => ({ createNewGame: mocks.createNewGame }));
vi.mock('../http/session.js', () => ({ requireUser: mocks.requireUser }));

import { createNewGameAction } from './new-game.js';
const action = createNewGameAction(mocks.db as D1Database);

function submit() {
	const request = new Request('https://huntboard.example/new', {
		method: 'POST',
		body: new URLSearchParams({ name: 'Canal hunt' })
	});
	return action({ request } as unknown as Parameters<typeof action>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireUser.mockResolvedValue({ id: 7, display_name: 'Sam' });
});

describe('/new', () => {
	it('fails with the status and what the page shows again', async () => {
		mocks.createNewGame.mockResolvedValue({
			status: 400,
			result: { name: '', error: 'Give the game a name.' }
		});

		expect(await submit()).toMatchObject({
			status: 400,
			data: { name: '', error: 'Give the game a name.' }
		});
	});

	it('creates the game for the signed-in user and redirects to it', async () => {
		mocks.createNewGame.mockResolvedValue({ adminToken: 'admin-token' });

		await expect(submit()).rejects.toMatchObject({ status: 303, location: '/a/admin-token' });
		const [db, ownerId, data] = mocks.createNewGame.mock.calls[0];
		expect(db).toBe(mocks.db);
		expect(ownerId).toBe(7);
		expect((data as FormData).get('name')).toBe('Canal hunt');
	});

	it('creates nothing without a session', async () => {
		mocks.requireUser.mockRejectedValue(Object.assign(new Error('redirect'), { status: 303 }));

		await expect(submit()).rejects.toMatchObject({ status: 303 });
		expect(mocks.createNewGame).not.toHaveBeenCalled();
	});
});
