import { describe, expect, it } from 'vitest';
import { REASON_MAX_LENGTH } from './reason.js';
import { ADJUSTMENT_MAX_POINTS, validateAdjustment } from './adjustment.js';

const POINTS_ERROR = 'Enter a whole number of points above 0, like 10.';

describe('validateAdjustment', () => {
	it('accepts a bonus with a reason, collapsing spaces', () => {
		expect(
			validateAdjustment({ sign: 'bonus', points: ' 10 ', reason: '  Best  costume ' })
		).toEqual({
			ok: true,
			adjustment: { points: 10, reason: 'Best costume' }
		});
	});

	it('takes points off for a penalty', () => {
		expect(
			validateAdjustment({ sign: 'penalty', points: '25', reason: 'Never showed up' })
		).toEqual({
			ok: true,
			adjustment: { points: -25, reason: 'Never showed up' }
		});
	});

	it.each(['-5', ' -5', '−5'])('accepts a penalty typed with a minus, %j', (points) => {
		expect(validateAdjustment({ sign: 'penalty', points, reason: 'Late' })).toEqual({
			ok: true,
			adjustment: { points: -5, reason: 'Late' }
		});
	});

	it.each(['-5', '−5'])('refuses a bonus typed with a minus, %j, and says why', (points) => {
		expect(validateAdjustment({ sign: 'bonus', points, reason: 'Late' })).toEqual({
			ok: false,
			errors: { points: 'A bonus adds points. Choose Penalty to take points off.' }
		});
	});

	it.each(['', 'ten', '2.5', '0', '-0', '--5', '+5'])('refuses %j points', (points) => {
		expect(validateAdjustment({ sign: 'penalty', points, reason: 'Bonus' })).toEqual({
			ok: false,
			errors: { points: POINTS_ERROR }
		});
	});

	it('reads anything but penalty as a bonus', () => {
		expect(validateAdjustment({ sign: '', points: '5', reason: 'Bonus' })).toEqual({
			ok: true,
			adjustment: { points: 5, reason: 'Bonus' }
		});
	});

	it.each(['bonus', 'penalty'])('accepts the limit for a %s', (sign) => {
		const result = validateAdjustment({
			sign,
			points: String(ADJUSTMENT_MAX_POINTS),
			reason: 'Bonus'
		});
		expect(result.ok && Math.abs(result.adjustment.points)).toBe(ADJUSTMENT_MAX_POINTS);
	});

	it('refuses points beyond the limit', () => {
		expect(
			validateAdjustment({
				sign: 'penalty',
				points: String(ADJUSTMENT_MAX_POINTS + 1),
				reason: 'Bonus'
			})
		).toEqual({
			ok: false,
			errors: { points: `Keep it within ${ADJUSTMENT_MAX_POINTS} points.` }
		});
	});

	it('asks for a reason', () => {
		expect(validateAdjustment({ sign: 'bonus', points: '5', reason: '   ' })).toEqual({
			ok: false,
			errors: { reason: 'Say why, so other judges know what it was for.' }
		});
	});

	it('accepts a reason of exactly the longest length', () => {
		const reason = 'x'.repeat(REASON_MAX_LENGTH);

		expect(validateAdjustment({ sign: 'bonus', points: '5', reason })).toEqual({
			ok: true,
			adjustment: { points: 5, reason }
		});
	});

	it('refuses a reason that is too long', () => {
		expect(
			validateAdjustment({ sign: 'bonus', points: '5', reason: 'x'.repeat(REASON_MAX_LENGTH + 1) })
		).toEqual({
			ok: false,
			errors: { reason: `Keep the reason to at most ${REASON_MAX_LENGTH} characters.` }
		});
	});

	it('reports both fields at once', () => {
		const result = validateAdjustment({ sign: 'bonus', points: '', reason: '' });

		expect(result.ok).toBe(false);
		expect(!result.ok && Object.keys(result.errors)).toEqual(['points', 'reason']);
	});
});
