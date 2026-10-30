import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reachable: vi.fn<() => Promise<boolean>>() }));

vi.mock('$app/navigation', () => ({ invalidate: vi.fn(async () => {}) }));
vi.mock('#lib/client/connection.js', async (actual) => ({
	...(await actual<typeof import('#lib/client/connection.js')>()),
	isReachable: mocks.reachable
}));

import { checkConnection, connection, reportOnline } from './connection.svelte.js';

function deferred() {
	let answer!: (online: boolean) => void;
	const result = new Promise<boolean>((resolve) => (answer = resolve));
	return { result, answer };
}

beforeEach(() => {
	connection.online = true;
	mocks.reachable.mockReset();
});

describe('checkConnection', () => {
	it('reports the result of the check', async () => {
		mocks.reachable.mockResolvedValue(false);

		await checkConnection();

		expect(connection.online).toBe(false);
	});

	it('ignores a check that ends after a check that started later', async () => {
		const slow = deferred();
		const fast = deferred();
		mocks.reachable.mockReturnValueOnce(slow.result).mockReturnValueOnce(fast.result);

		const first = checkConnection();
		const second = checkConnection();
		fast.answer(true);
		await second;
		slow.answer(false);
		await first;

		expect(connection.online).toBe(true);
	});

	it('ignores a check that ends after the page saw an answer', async () => {
		const slow = deferred();
		mocks.reachable.mockReturnValueOnce(slow.result);

		const check = checkConnection();
		reportOnline(true);
		slow.answer(false);
		await check;

		expect(connection.online).toBe(true);
	});
});
