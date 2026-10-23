import { describe, expect, expectTypeOf, it } from 'vitest';
import { resultUnder, type KindResultKey } from './action-results.js';

describe('resultUnder', () => {
	it('reads the result under the key', () => {
		const data = { judge: { kind: 'rejected' } };

		expect(resultUnder(data, 'judge')).toEqual({ kind: 'rejected' });
		expect(resultUnder(data, 'teamScores')).toBeUndefined();
		expect(resultUnder(null, 'judge')).toBeUndefined();
	});
});

// Checked by pnpm check, not at run time.
expectTypeOf<KindResultKey>().toEqualTypeOf<'challenges' | 'judge' | 'team' | 'teamScores'>();
