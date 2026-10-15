import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: {
		CREATE_GAME_CODE: 'creation-secret',
		TURNSTILE_SITE_KEY: 'site-key',
		TURNSTILE_SECRET_KEY: 'secret-key',
		CREATE_GAME_RATE_LIMITER: { limit: vi.fn() },
		DB: {}
	},
	createGame: vi.fn(),
	creationCodeMatches: vi.fn()
}));

vi.mock('#lib/server/db/games.js', () => ({ createGame: mocks.createGame }));
vi.mock('#lib/server/creation-code.js', () => ({ creationCodeMatches: mocks.creationCodeMatches }));

import { createNewGameAction } from './new-game.js';
const action = createNewGameAction(mocks.env as unknown as Cloudflare.Env, false);

function submission(token = 'challenge-token') {
	const request = new Request('https://huntboard.example/new', {
		method: 'POST',
		body: new URLSearchParams({
			name: 'Canal hunt',
			code: 'creation-secret',
			'cf-turnstile-response': token
		}),
		headers: { 'X-Forwarded-For': 'spoofed-ip' }
	});
	const formData = vi.spyOn(request, 'formData');
	const fetch = vi
		.fn()
		.mockResolvedValue(
			Response.json({ success: true, hostname: 'huntboard.example', action: 'create-game' })
		);
	const event = {
		request,
		url: new URL(request.url),
		fetch,
		getClientAddress: vi.fn().mockReturnValue('192.0.2.1'),
		setHeaders: vi.fn()
	};
	return { event, formData, fetch };
}

function submit(event: ReturnType<typeof submission>['event']) {
	return action(event as unknown as Parameters<typeof action>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.env.TURNSTILE_SECRET_KEY = 'secret-key';
	mocks.env.CREATE_GAME_RATE_LIMITER.limit.mockResolvedValue({ success: true });
	mocks.creationCodeMatches.mockResolvedValue(true);
	mocks.createGame.mockResolvedValue({ admin_token: 'admin-token' });
});

describe('/new protection', () => {
	it('rate-limits before parsing or verifying and supplies a retry delay', async () => {
		mocks.env.CREATE_GAME_RATE_LIMITER.limit.mockResolvedValue({ success: false });
		const { event, formData, fetch } = submission();
		expect(await submit(event)).toMatchObject({ status: 429 });
		expect(event.setHeaders).toHaveBeenCalledWith({ 'Retry-After': '60' });
		expect(mocks.env.CREATE_GAME_RATE_LIMITER.limit).toHaveBeenCalledWith({
			key: 'huntboard:new:192.0.2.1'
		});
		expect(formData).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
		expect(mocks.creationCodeMatches).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('fails closed when the limiter is unavailable', async () => {
		mocks.env.CREATE_GAME_RATE_LIMITER.limit.mockRejectedValue(new Error('Unavailable'));
		const { event, formData } = submission();
		expect(await submit(event)).toMatchObject({ status: 503 });
		expect(formData).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('fails closed when Turnstile is unconfigured', async () => {
		mocks.env.TURNSTILE_SECRET_KEY = '';
		const { event, formData } = submission();
		expect(await submit(event)).toMatchObject({ status: 503 });
		expect(formData).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('rejects missing verification before checking the creation code', async () => {
		const { event, fetch } = submission('');
		expect(await submit(event)).toMatchObject({ status: 403 });
		expect(fetch).not.toHaveBeenCalled();
		expect(mocks.creationCodeMatches).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it.each([
		{ success: false },
		{ success: true, hostname: 'other.example', action: 'create-game' },
		{ success: true, hostname: 'huntboard.example', action: 'other-form' }
	])('rejects invalid verification before checking the code: %j', async (result) => {
		const { event, fetch } = submission();
		fetch.mockResolvedValue(Response.json(result));
		expect(await submit(event)).toMatchObject({ status: 403 });
		expect(mocks.creationCodeMatches).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('fails closed on verification outages', async () => {
		const { event, fetch } = submission();
		fetch.mockRejectedValue(new Error('Timeout'));
		expect(await submit(event)).toMatchObject({ status: 503 });
		expect(mocks.creationCodeMatches).not.toHaveBeenCalled();
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('still requires the creation code after a valid challenge', async () => {
		mocks.creationCodeMatches.mockResolvedValue(false);
		const { event } = submission();
		expect(await submit(event)).toMatchObject({ status: 403, data: { name: 'Canal hunt' } });
		expect(mocks.createGame).not.toHaveBeenCalled();
	});

	it('creates a game only after passing all checks', async () => {
		const { event } = submission();
		await expect(submit(event)).rejects.toMatchObject({ status: 303, location: '/a/admin-token' });
		expect(mocks.creationCodeMatches).toHaveBeenCalledWith('creation-secret', 'creation-secret');
		expect(mocks.createGame).toHaveBeenCalledWith(mocks.env.DB, 'Canal hunt');
	});
});
