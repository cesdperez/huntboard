import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { CREATE_GAME_CODE: 'creation-secret', DB: {} },
	createNewGame: vi.fn()
}));

vi.mock('#lib/server/use-cases/new-game.js', () => ({ createNewGame: mocks.createNewGame }));

import { createNewGameAction } from './new-game.js';
const action = createNewGameAction(mocks.env as unknown as Cloudflare.Env);

function submit() {
	const request = new Request('https://huntboard.example/new', {
		method: 'POST',
		body: new URLSearchParams({ name: 'Canal hunt', code: 'creation-secret' })
	});
	return action({ request } as unknown as Parameters<typeof action>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('/new', () => {
	it('fails with the status and what the page shows again', async () => {
		mocks.createNewGame.mockResolvedValue({
			status: 403,
			result: { name: 'Canal hunt', error: 'Wrong code' }
		});

		expect(await submit()).toMatchObject({
			status: 403,
			data: { name: 'Canal hunt', error: 'Wrong code' }
		});
	});

	it('redirects to the new game with the configured code', async () => {
		mocks.createNewGame.mockResolvedValue({ adminToken: 'admin-token' });

		await expect(submit()).rejects.toMatchObject({ status: 303, location: '/a/admin-token' });
		const [db, code, data] = mocks.createNewGame.mock.calls[0];
		expect(db).toBe(mocks.env.DB);
		expect(code).toBe('creation-secret');
		expect((data as FormData).get('name')).toBe('Canal hunt');
	});
});
