import type { ActionResult } from '$app/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY } from '#lib/components/team/action-message.js';

const mocks = vi.hoisted(() => ({
	applyAction: vi.fn(async () => {}),
	connection: { online: true, stale: false },
	refreshGameData: vi.fn(async () => {}),
	reportOnline: vi.fn(),
	show: vi.fn(),
	focusIfLost: vi.fn((_target: unknown) => {})
}));

vi.mock('$app/forms', () => ({ applyAction: mocks.applyAction }));
vi.mock('#lib/components/connection/index.js', () => ({
	connection: mocks.connection,
	refreshGameData: mocks.refreshGameData,
	reportOnline: mocks.reportOnline
}));
vi.mock('#lib/components/toast/index.js', () => ({ toast: { show: mocks.show } }));
vi.mock('#lib/client/focus.js', () => ({ focusIfLost: mocks.focusIfLost }));

import { updateOrRetry } from './update-or-retry.js';

class FakeElement {
	isConnected = true;
}

class FakeForm extends FakeElement {
	resets = 0;
	reset() {
		this.resets++;
	}
}

const SETUP = '/a/token/setup';
const LOST: ActionResult = {
	type: 'error',
	status: 500,
	error: { message: 'Failed to fetch', status: 500 }
};
const SAVED: ActionResult = { type: 'success', status: 200, data: { teams: {} }, location: SETUP };
const REFUSED: ActionResult = {
	type: 'failure',
	status: 400,
	data: { teams: { error: 'That name is taken.' } },
	location: SETUP
};
const DEAD: ActionResult = {
	type: 'error',
	status: 404,
	error: { message: 'Not found', status: 404 }
};

let form: FakeForm;
let button: FakeElement;
let update: ReturnType<typeof vi.fn<(options?: { reset?: boolean }) => Promise<void>>>;

function settle(result: ActionResult) {
	return { result, formElement: form as unknown as HTMLFormElement, update };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.connection.online = true;
	mocks.connection.stale = false;
	form = new FakeForm();
	button = new FakeElement();
	update = vi.fn(async () => {});
	vi.stubGlobal('HTMLElement', FakeElement);
	vi.stubGlobal('HTMLFormElement', FakeForm);
	vi.stubGlobal('document', { activeElement: button });
	vi.stubGlobal('location', { pathname: SETUP, search: '' });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('updateOrRetry', () => {
	it('refreshes a success the way polls do, so a failed reload keeps the page', async () => {
		const order: string[] = [];
		mocks.refreshGameData.mockImplementationOnce(async () => void order.push('refresh'));
		mocks.applyAction.mockImplementationOnce(async () => void order.push('apply'));

		expect(await updateOrRetry(settle(SAVED))).toBe(SAVED);

		expect(order).toEqual(['refresh', 'apply']);
		expect(mocks.applyAction).toHaveBeenCalledWith(SAVED);
		expect(update).not.toHaveBeenCalled();
		expect(form.resets).toBe(1);
	});

	it('keeps the fields of a form that asks not to reset', async () => {
		await updateOrRetry(settle(SAVED), { reset: false });

		expect(form.resets).toBe(0);
	});

	it('shows a refusal without a refresh and keeps what was typed', async () => {
		expect(await updateOrRetry(settle(REFUSED))).toBe(REFUSED);

		expect(mocks.refreshGameData).not.toHaveBeenCalled();
		expect(mocks.applyAction).toHaveBeenCalledWith(REFUSED);
		expect(form.resets).toBe(0);
	});

	it('lets SvelteKit show the dead link page', async () => {
		await updateOrRetry(settle(DEAD));

		expect(update).toHaveBeenCalledOnce();
		expect(mocks.applyAction).not.toHaveBeenCalled();
	});

	it('keeps focus on the control that sent the form', async () => {
		await updateOrRetry(settle(SAVED));

		expect(mocks.focusIfLost.mock.calls[0]?.[0]).toBe(button);
	});

	describe('with a lost answer', () => {
		it('shows a request that went through as a success and clears the form', async () => {
			let saved = false;
			mocks.refreshGameData.mockImplementationOnce(async () => void (saved = true));

			const result = await updateOrRetry(settle(LOST), { tookEffect: () => saved });

			expect(result).toEqual({ type: 'success', status: 200, location: SETUP });
			expect(mocks.show).not.toHaveBeenCalled();
			expect(mocks.applyAction).toHaveBeenCalledWith(result);
			expect(form.resets).toBe(1);
			expect(mocks.refreshGameData).toHaveBeenCalledOnce();
		});

		it('applies the data the lost answer would have carried', async () => {
			const data = { links: { rotated: 'scoreboard' } };

			await updateOrRetry(settle(LOST), { tookEffect: async () => data });

			expect(mocks.applyAction).toHaveBeenCalledWith({
				type: 'success',
				status: 200,
				data,
				location: SETUP
			});
		});

		it('asks for a retry when the refreshed page shows it did not go through', async () => {
			expect(await updateOrRetry(settle(LOST), { tookEffect: () => false })).toBe(LOST);

			expect(mocks.show).toHaveBeenCalledWith(RETRY);
			expect(mocks.applyAction).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
			expect(form.resets).toBe(0);
		});

		it.each([
			['offline', { online: false, stale: false }],
			['the refresh failed', { online: true, stale: true }]
		])('asks for a retry without checking when %s', async (_case, state) => {
			mocks.refreshGameData.mockImplementationOnce(async () => {
				Object.assign(mocks.connection, state);
			});
			const tookEffect = vi.fn(() => true);

			await updateOrRetry(settle(LOST), { tookEffect });

			expect(tookEffect).not.toHaveBeenCalled();
			expect(mocks.show).toHaveBeenCalledWith(RETRY);
		});

		it('asks for a retry when the form has no check', async () => {
			await updateOrRetry(settle(LOST));

			expect(mocks.show).toHaveBeenCalledWith(RETRY);
		});
	});
});
