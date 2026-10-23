import { createContext } from 'svelte';
import { formatClockTime, formatDay } from '#lib/format/clock-time.js';
import { claimsClosedMessage } from '#lib/domain/claim-messages.js';
import { countdownLine } from '#lib/domain/countdown.js';
import { gamePhase, type GamePhase, type GameWindow } from '#lib/domain/game-window.js';

/**
 * The viewer's clock against the game window, ticking once a second. Everything is null until
 * start() runs in the browser, because the server runs in UTC and must not guess the viewer's time.
 */
export class GameClock {
	// A plain number, not a SvelteDate: its lazy deriveds belong to whichever effect read them
	// first, and the sheet's claim block that reads them is destroyed on every mark and undo.
	#nowMs = $state<number | null>(null);
	readonly #window: () => GameWindow;

	constructor(window: () => GameWindow) {
		this.#window = window;
	}

	get now(): Date | null {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a fresh snapshot per read, never mutated
		return this.#nowMs === null ? null : new Date(this.#nowMs);
	}

	formatTime = (iso: string): string =>
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a fresh snapshot per read, never mutated
		formatClockTime(iso, new Date(this.#nowMs ?? Date.now()));

	closedMessageFor = (phase: Exclude<GamePhase, 'during'>): string =>
		claimsClosedMessage(phase, this.#window(), this.formatTime);

	get phase(): GamePhase | null {
		return this.now && gamePhase(this.#window(), this.now);
	}

	get countdown(): string | null {
		return this.now && countdownLine(this.#window(), this.now, this.formatTime);
	}

	/** The day the game starts, like "24 October", or null without a start time. */
	get startDay(): string | null {
		const { startsAt } = this.#window();
		return this.now && startsAt ? formatDay(startsAt, this.now) : null;
	}

	/** Why claims are closed now, or null while they are open or the clock has not started. */
	get closedMessage(): string | null {
		const phase = this.phase;
		return phase && phase !== 'during' ? this.closedMessageFor(phase) : null;
	}

	start(): () => void {
		this.#nowMs = Date.now();
		const timer = setInterval(() => (this.#nowMs = Date.now()), 1000);
		return () => clearInterval(timer);
	}
}

/** A layout's clock, so the pages under it share one tick instead of starting their own. */
export const [getGameClock, setGameClock] = createContext<GameClock>();
