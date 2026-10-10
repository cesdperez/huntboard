import { GAME_NAME_MAX_LENGTH, LATE_PENALTY_MAX } from '#lib/game-settings.js';
import type { GameSettings } from './db/games.js';
import { readString, readUtcTime } from './form.js';

export type GameSettingsErrors = Partial<Record<keyof GameSettings, string>>;

type GameTimes = Pick<GameSettings, 'starts_at' | 'ends_at'>;

/** Times are absent when the form had none to send, so the stored times stay as they are. */
export type ParsedGameSettings = Omit<GameSettings, keyof GameTimes> & Partial<GameTimes>;

export type GameSettingsResult =
	{ ok: true; settings: ParsedGameSettings } | { ok: false; errors: GameSettingsErrors };

/** Shared by game creation and the settings form, so a created game can always be saved again. */
export function gameNameError(name: string): string | null {
	if (!name) return 'Give the game a name.';
	if (name.length > GAME_NAME_MAX_LENGTH) {
		return `Keep the name to ${GAME_NAME_MAX_LENGTH} characters or fewer.`;
	}
	return null;
}

/**
 * Reads the game settings form. The browser sends times already converted to UTC ISO,
 * or '' for a time that is not set. Before hydration it sends no time fields at all.
 */
export function parseGameSettings(data: FormData): GameSettingsResult {
	const errors: GameSettingsErrors = {};

	const name = readString(data, 'name');
	const nameError = gameNameError(name);
	if (nameError) errors.name = nameError;

	const startsAt = readUtcTime(data, 'starts_at');
	if (startsAt === undefined) errors.starts_at = 'Enter a valid start time.';
	const endsAt = readUtcTime(data, 'ends_at');
	if (endsAt === undefined) errors.ends_at = 'Enter a valid end time.';
	else if (startsAt && endsAt && endsAt <= startsAt) {
		errors.ends_at = 'End the game after it starts.';
	}

	const penalty = readString(data, 'late_penalty_per_minute');
	const latePenalty = Number(penalty);
	if (!/^\d+$/.test(penalty) || latePenalty > LATE_PENALTY_MAX) {
		errors.late_penalty_per_minute = 'Enter a whole number of points, 0 or more.';
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	const settings: ParsedGameSettings = { name, late_penalty_per_minute: latePenalty };
	if (data.has('starts_at') || data.has('ends_at')) {
		settings.starts_at = startsAt ?? null;
		settings.ends_at = endsAt ?? null;
	}
	return { ok: true, settings };
}
