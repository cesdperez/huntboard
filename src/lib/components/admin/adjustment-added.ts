import { validateAdjustment } from '#lib/domain/adjustment.js';
import type { AdjustmentItem } from '#lib/server/pages/judging-pages.js';

/** Whether after holds an adjustment, not among beforeIds, that the add form sent as formData. */
export function adjustmentAdded(
	beforeIds: number[],
	after: AdjustmentItem[],
	formData: FormData
): boolean {
	const text = (key: string) => {
		const value = formData.get(key);
		return typeof value === 'string' ? value : '';
	};
	const sent = validateAdjustment({
		sign: text('sign'),
		points: text('points'),
		reason: text('reason')
	});
	if (!sent.ok) return false;
	const { points, reason } = sent.adjustment;
	return after.some(
		(each) => !beforeIds.includes(each.id) && each.points === points && each.reason === reason
	);
}
