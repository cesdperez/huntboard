import { describe, expect, it } from 'vitest';
import { byQueueOrder, takesPlaceOf } from './queue-order.js';

const claim = (id: number, marked_at: string) => ({ id, marked_at });

describe('byQueueOrder', () => {
	it('puts the oldest claim first and breaks ties by id', () => {
		const claims = [claim(3, '12:05'), claim(2, '12:00'), claim(1, '12:05')];
		expect(claims.sort(byQueueOrder).map((c) => c.id)).toEqual([2, 1, 3]);
	});
});

describe('takesPlaceOf', () => {
	const remaining = [claim(1, '12:00'), claim(3, '12:10')];

	it('is the claim that moved up into the judged one place', () => {
		expect(takesPlaceOf(remaining, claim(2, '12:05'))?.id).toBe(3);
	});

	it('is the claim above when the judged one was last', () => {
		expect(takesPlaceOf(remaining, claim(4, '12:20'))?.id).toBe(3);
	});

	it('is nothing once the queue is empty', () => {
		expect(takesPlaceOf([], claim(2, '12:05'))).toBeNull();
	});
});
