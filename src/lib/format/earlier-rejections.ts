import type { EarlierRejections } from '#lib/domain/judging-grid.js';
import { isolate } from './text.js';

/** "Rejected once before: no proof", shown to a judge looking at another try. */
export function earlierRejectionsText({ count, lastNote }: EarlierRejections): string {
	const times = count === 1 ? 'Rejected once before' : `Rejected ${count} times before`;
	return lastNote ? `${times}: ${isolate(lastNote)}` : `${times}.`;
}
