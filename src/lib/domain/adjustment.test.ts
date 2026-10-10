import { describe, expect, it } from 'vitest';
import { REASON_MAX_LENGTH } from '../reason.js';
import { ADJUSTMENT_MAX_POINTS, validateAdjustment } from './adjustment.js';

describe('validateAdjustment', () => {
	it('accepts a bonus with a reason, collapsing spaces', () => {
		expect(validateAdjustment({ points: ' 10 ', reason: '  Best  costume ' })).toEqual({
			ok: true,
			adjustment: { points: 10, reason: 'Best costume' }
		});
	});

	it('accepts a penalty', () => {
		expect(validateAdjustment({ points: '-25', reason: 'Never showed up' })).toEqual({
			ok: true,
			adjustment: { points: -25, reason: 'Never showed up' }
		});
	});

	it.each(['', 'ten', '2.5', '0', '-0'])('refuses %j points', (points) => {
		expect(validateAdjustment({ points, reason: 'Bonus' })).toEqual({
			ok: false,
			errors: { points: 'Enter a whole number of points, like 10 or -5. Not 0.' }
		});
	});

	it.each([ADJUSTMENT_MAX_POINTS, -ADJUSTMENT_MAX_POINTS])('accepts %i, the limit', (points) => {
		expect(validateAdjustment({ points: String(points), reason: 'Bonus' })).toEqual({
			ok: true,
			adjustment: { points, reason: 'Bonus' }
		});
	});

	it('refuses points beyond the limit either way', () => {
		const tooMuch = String(ADJUSTMENT_MAX_POINTS + 1);
		const message = `Keep it within ${ADJUSTMENT_MAX_POINTS} points either way.`;

		expect(validateAdjustment({ points: tooMuch, reason: 'Bonus' })).toEqual({
			ok: false,
			errors: { points: message }
		});
		expect(validateAdjustment({ points: `-${tooMuch}`, reason: 'Bonus' })).toEqual({
			ok: false,
			errors: { points: message }
		});
	});

	it('asks for a reason', () => {
		expect(validateAdjustment({ points: '5', reason: '   ' })).toEqual({
			ok: false,
			errors: { reason: 'Say why, so other judges know what it was for.' }
		});
	});

	it('accepts a reason of exactly the longest length', () => {
		const reason = 'x'.repeat(REASON_MAX_LENGTH);

		expect(validateAdjustment({ points: '5', reason })).toEqual({
			ok: true,
			adjustment: { points: 5, reason }
		});
	});

	it('refuses a reason that is too long', () => {
		expect(validateAdjustment({ points: '5', reason: 'x'.repeat(REASON_MAX_LENGTH + 1) })).toEqual({
			ok: false,
			errors: { reason: `Keep the reason to at most ${REASON_MAX_LENGTH} characters.` }
		});
	});

	it('reports both fields at once', () => {
		const result = validateAdjustment({ points: '', reason: '' });

		expect(result.ok).toBe(false);
		expect(!result.ok && Object.keys(result.errors)).toEqual(['points', 'reason']);
	});
});
