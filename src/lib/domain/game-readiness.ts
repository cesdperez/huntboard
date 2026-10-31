import { plural } from '../format/plural.js';
import type { GamePhase, GameWindow } from './game-window.js';

export type ReadinessCheck = {
	key: 'times' | 'challenges' | 'teams';
	met: boolean;
	/** What is in place when met, or what to do when not. */
	label: string;
};

export type GameReadiness = { ready: boolean; checks: ReadinessCheck[] };

/** What a game needs before teams can play it: both times, a challenge and a team. */
export function gameReadiness(
	window: GameWindow,
	counts: { challenges: number; teams: number }
): GameReadiness {
	// Without both times the game window never opens, so teams could never claim.
	const scheduled = window.startsAt !== null && window.endsAt !== null;
	const checks: ReadinessCheck[] = [
		{
			key: 'times',
			met: scheduled,
			label: scheduled ? 'Start and end time set' : 'Set the start and end time'
		},
		{
			key: 'challenges',
			met: counts.challenges > 0,
			label: counts.challenges > 0 ? plural(counts.challenges, 'challenge') : 'Add challenges'
		},
		{
			key: 'teams',
			met: counts.teams > 0,
			label: counts.teams > 0 ? plural(counts.teams, 'team') : 'Add teams'
		}
	];
	return { ready: checks.every((check) => check.met), checks };
}

/** The game state ahead of its countdown line, like "Live. Ends in 1:42:10". */
export function gameStateLine(phase: GamePhase, countdown: string): string {
	switch (phase) {
		case 'before':
			return `Not started. ${countdown}`;
		case 'during':
			return `Live. ${countdown}`;
		// "Ended at 21:00" already says it.
		case 'after':
			return countdown;
	}
}
