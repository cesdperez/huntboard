export type MarkerState = 'open' | 'pending' | 'scored' | 'rejected';

const stateNames: Record<MarkerState, string> = {
	open: 'Open',
	pending: 'Pending',
	scored: 'Scored',
	rejected: 'Rejected'
};

/** Accessible name for a claim marker, e.g. "Scored 15 points". */
export function markerLabel(state: MarkerState, points?: number): string {
	if (state === 'scored' && points !== undefined) {
		return `Scored ${points} ${points === 1 ? 'point' : 'points'}`;
	}
	return stateNames[state];
}
