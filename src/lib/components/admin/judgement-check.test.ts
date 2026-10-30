import { parse, stringify } from 'devalue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Kit's own deserialize needs the app's transport set up, which only a running app does.
vi.mock('$app/forms', () => ({
	deserialize: (text: string) => {
		const result = JSON.parse(text);
		return result.data ? { ...result, data: parse(result.data) } : result;
	}
}));

import { askWhatJudgementDid } from './judgement-check.js';

const fetchMock = vi.fn<typeof fetch>();

function answer(type: 'success' | 'failure', status: number, judge: unknown) {
	return new Response(JSON.stringify({ type, status, data: stringify({ judge }) }));
}

function sent(): FormData {
	const data = new FormData();
	data.set('claimId', '4');
	data.set('from', 'pending');
	data.set('points', '12');
	data.set('nickname', 'Alex');
	return data;
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('askWhatJudgementDid', () => {
	it('asks the check action with the sent fields and the verdict', async () => {
		fetchMock.mockResolvedValue(answer('success', 200, { kind: 'unchanged' }));

		await askWhatJudgementDid(sent(), 'scored');

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('?/judgeCheck');
		const body = init?.body as FormData;
		expect(Object.fromEntries(body)).toEqual({
			claimId: '4',
			from: 'pending',
			points: '12',
			nickname: 'Alex',
			verdict: 'scored'
		});
	});

	it('says a judgement that left the claim as it was did not go through', async () => {
		fetchMock.mockResolvedValue(answer('success', 200, { kind: 'unchanged' }));

		expect(await askWhatJudgementDid(sent(), 'scored')).toBe(false);
	});

	it('passes on the answer the judgement should have had', async () => {
		fetchMock.mockResolvedValue(answer('success', 200, { kind: 'scored', points: 12 }));

		expect(await askWhatJudgementDid(sent(), 'scored')).toMatchObject({
			type: 'success',
			data: { judge: { kind: 'scored', points: 12 } }
		});
	});

	it('passes on who got there first', async () => {
		const conflict = { kind: 'error', message: 'Sam already scored this: 15 points.' };
		fetchMock.mockResolvedValue(answer('failure', 409, conflict));

		expect(await askWhatJudgementDid(sent(), 'scored')).toMatchObject({
			type: 'failure',
			data: { judge: conflict }
		});
	});
});
