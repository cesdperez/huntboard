import { SvelteDate } from 'svelte/reactivity';
import { formatClockTime } from '#lib/clock-time.js';
import { claimsClosedMessage } from '#lib/domain/claim-messages.js';
import { countdownLine } from '#lib/domain/countdown.js';
import { gamePhase, type GamePhase, type GameWindow } from '#lib/domain/game-window.js';

/**
 * The viewer's clock against the game window, ticking once a second. Everything is null until
 * start() runs in the browser, because the server runs in UTC and must not guess the viewer's time.
 */
export class GameClock {
	readonly #now = new SvelteDate();
	#started = $state(false);
	readonly #window: () => GameWindow;

	constructor(window: () => GameWindow) {
		this.#window = window;
	}

	get now(): Date | null {
		return this.#started ? this.#now : null;
	}

	formatTime = (iso: string): string => formatClockTime(iso, this.#now);

	closedMessageFor = (phase: Exclude<GamePhase, 'during'>): string =>
		claimsClosedMessage(phase, this.#window(), this.formatTime);

	get phase(): GamePhase | null {
		return this.now && gamePhase(this.#window(), this.now);
	}

	get countdown(): string | null {
		return this.now && countdownLine(this.#window(), this.now, this.formatTime);
	}

	/** Why claims are closed now, or null while they are open or the clock has not started. */
	get closedMessage(): string | null {
		const phase = this.phase;
		return phase && phase !== 'during' ? this.closedMessageFor(phase) : null;
	}

	start(): () => void {
		this.#now.setTime(Date.now());
		this.#started = true;
		const timer = setInterval(() => this.#now.setTime(Date.now()), 1000);
		return () => clearInterval(timer);
	}
}
