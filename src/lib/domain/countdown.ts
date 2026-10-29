import { plural } from '../format/plural.js';
import { gamePhase, type GameWindow } from './game-window.js';

export type Countdown =
	| { kind: 'unscheduled' }
	| { kind: 'starts'; ms: number }
	| { kind: 'ends'; ms: number }
	| { kind: 'ended'; endsAt: string };

/** What the team strip counts down to: the start before the game, the end while it runs. */
export function countdown(window: GameWindow, now: Date): Countdown {
	if (!window.startsAt || !window.endsAt) return { kind: 'unscheduled' };
	switch (gamePhase(window, now)) {
		case 'before':
			return { kind: 'starts', ms: Date.parse(window.startsAt) - now.getTime() };
		case 'during':
			return { kind: 'ends', ms: Date.parse(window.endsAt) - now.getTime() };
		case 'after':
			return { kind: 'ended', endsAt: window.endsAt };
	}
}

/** "1:42:10", or "3 days 1:42:10" once a day or more remains. Hours always show, so the width stays steady. */
export function formatCountdown(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const pad = (n: number) => String(n).padStart(2, '0');
	const days = Math.floor(total / 86_400);
	const clock = `${Math.floor(total / 3600) % 24}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
	return days > 0 ? `${plural(days, 'day')} ${clock}` : clock;
}

/** The countdown line on the team strip. formatTime shows a UTC ISO time to the viewer. */
export function countdownLine(
	window: GameWindow,
	now: Date,
	formatTime: (iso: string) => string
): string {
	const status = countdown(window, now);
	switch (status.kind) {
		case 'unscheduled':
			return window.startsAt ? 'End time not set yet' : 'Start time not set yet';
		case 'starts':
			return `Starts in ${formatCountdown(status.ms)}`;
		case 'ends':
			return `Ends in ${formatCountdown(status.ms)}`;
		case 'ended':
			return `Ended at ${formatTime(status.endsAt)}`;
	}
}
