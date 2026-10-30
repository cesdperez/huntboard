import { plural } from '#lib/format/plural.js';
import type { SetupTeam } from '#lib/server/db/types.js';

/** The confirm before deleting a team, naming the adjustments and arrival time that go with it. */
export function deleteTeamQuestion(
	team: Pick<SetupTeam, 'name' | 'adjustment_count' | 'arrived_at'>
): string {
	const lost: string[] = [];
	if (team.adjustment_count > 0) lost.push(plural(team.adjustment_count, 'adjustment'));
	if (team.arrived_at) lost.push('arrival time');
	if (lost.length === 0) return `Delete ${team.name}? Its link stops working.`;

	const verb = lost.length > 1 || team.adjustment_count > 1 ? 'are' : 'is';
	return `Delete ${team.name}? Its ${lost.join(' and its ')} ${verb} deleted too, and its link stops working.`;
}
