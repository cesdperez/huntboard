import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { CREATE_GAME_CODE: 'creation-secret', DB: {} },
	createGame: vi.fn(),
	creationCodeMatches: vi.fn()
}));

vi.mock('#lib/server/db/games.js', () => ({ createGame: mocks.createGame }));
vi.mock('#lib/server/creation-code.js', () => ({ creationCodeMatches: mocks.creationCodeMatches }));

import { createNewGameAction } from './new-game.js';
const action = createNewGameAction(mocks.env as unknown as Cloudflare.Env);

function submit(name = 'Canal hunt') {
	const request = new Request('https://huntboard.example/new', {
		method: 'POST',
		body: new URLSearchParams({ name, code: 'creation-secret' })
	});
	return action({ request } as unknown as Parameters<typeof action>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.creationCodeMatches.mockResolvedValue(true);
	mocks.createGame.mockResolvedValue({ admin_token: 'admin-token' });
});

describe('/new', () => {
	it('rejects a wrong creation code', async () => {
		mocks.creationCodeMatches.mockResolvedValue(false);
		expect(await submit()).toMatchObject({ status: 403, data: { name: 'Canal hunt' } });
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('rejects an invalid name before checking the code', async () => {
		expect(await submit('')).toMatchObject({ status: 400 });
		expect(mocks.creationCodeMatches).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('creates a game when the code matches', async () => {
		await expect(submit()).rejects.toMatchObject({ status: 303, location: '/a/admin-token' });
		expect(mocks.creationCodeMatches).toHaveBeenCalledWith('creation-secret', 'creation-secret');
		expect(mocks.createGame).toHaveBeenCalledWith(mocks.env.DB, 'Canal hunt');
	});
});
