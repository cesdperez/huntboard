import type { ActionResult, SubmitFunction } from '$app/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameClock } from '#lib/client/game-clock.svelte.js';
import { RETRY } from './action-message.js';

const mocks = vi.hoisted(() => ({
	connection: { online: true, stale: false },
	refreshGameData: vi.fn(),
	show: vi.fn()
}));

vi.mock('#lib/components/connection/index.js', () => ({
	connection: mocks.connection,
	refreshGameData: mocks.refreshGameData
}));
vi.mock('#lib/components/toast/index.js', () => ({ toast: { show: mocks.show } }));

import { TeamAction } from './team-action.svelte.js';

const clock = { closedMessageFor: () => 'Closed.' } as unknown as GameClock;
const LOST: ActionResult = { type: 'error', error: { message: 'Failed to fetch', status: 500 } };

/** Sends the form and settles it with result, the way enhance does. */
async function send(submit: SubmitFunction, result: ActionResult) {
	const formData = new FormData();
	formData.set('challengeId', '7');
	const settle = await submit({ formData } as Parameters<SubmitFunction>[0]);
	await settle?.({ result } as Parameters<NonNullable<typeof settle>>[0]);
}

let state: string;
let action: TeamAction;

beforeEach(() => {
	vi.clearAllMocks();
	mocks.refreshGameData.mockReset().mockResolvedValue(undefined);
	mocks.connection.online = true;
	mocks.connection.stale = false;
	state = 'open';
	action = new TeamAction(
		() => clock,
		() => state
	);
});

describe('TeamAction', () => {
	it('shows a lost request that went through as done', async () => {
		mocks.refreshGameData.mockImplementation(async () => (state = 'pending'));
		const onsuccess = vi.fn();

		await send(
			action.submit('Marked done', onsuccess, () => () => state === 'pending'),
			LOST
		);

		expect(action.error).toBeNull();
		expect(onsuccess).toHaveBeenCalledOnce();
		expect(mocks.show).toHaveBeenCalledWith('Marked done');
		expect(action.busy).toBe(false);
	});

	it('asks for a retry when the refreshed page shows the request did not go through', async () => {
		const onsuccess = vi.fn();

		await send(
			action.submit('Marked done', onsuccess, () => () => state === 'pending'),
			LOST
		);

		expect(action.error).toBe(RETRY);
		expect(onsuccess).not.toHaveBeenCalled();
	});

	it('asks for a retry when the refresh cannot reach the server', async () => {
		mocks.refreshGameData.mockImplementation(async () => (mocks.connection.online = false));
		const onsuccess = vi.fn();

		await send(
			action.submit('Marked done', onsuccess, () => () => true),
			LOST
		);

		expect(action.error).toBe(RETRY);
		expect(onsuccess).not.toHaveBeenCalled();
	});

	it('notes the state before sending and checks it after the refresh', async () => {
		mocks.refreshGameData.mockImplementation(async () => (state = 'pending'));
		const seen: string[] = [];

		await send(
			action.submit('Marked done', vi.fn(), () => {
				seen.push(state);
				return () => (seen.push(state), true);
			}),
			LOST
		);

		expect(seen).toEqual(['open', 'pending']);
	});

	it('keeps an answered refusal even when the check would pass', async () => {
		const refused: ActionResult = {
			type: 'failure',
			status: 409,
			location: '/t/token',
			data: { team: { kind: 'error', message: 'Sam already marked this done.' } }
		};

		await send(
			action.submit('Marked done', vi.fn(), () => () => true),
			refused
		);

		expect(action.error).toBe('Sam already marked this done.');
	});
});
