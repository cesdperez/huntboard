import type { GameSettings } from './db/games.js';
import { readString } from './form.js';

export const GAME_NAME_MAX_LENGTH = 100;
// Keeps penalty times minutes late far below Number.MAX_SAFE_INTEGER.
export const LATE_PENALTY_MAX = 1_000_000;

export type GameSettingsErrors = Partial<Record<keyof GameSettings, string>>;

export type GameSettingsResult =
	{ ok: true; settings: GameSettings } | { ok: false; errors: GameSettingsErrors };

/**
 * Reads the game settings form. The browser sends times already converted to UTC ISO,
 * or '' for a time that is not set.
 */
export function parseGameSettings(data: FormData): GameSettingsResult {
	const errors: GameSettingsErrors = {};

	const name = readString(data, 'name');
	if (!name) errors.name = 'Give the game a name.';
	else if (name.length > GAME_NAME_MAX_LENGTH) {
		errors.name = `Keep the name to ${GAME_NAME_MAX_LENGTH} characters or fewer.`;
	}

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
	return {
		ok: true,
		settings: {
			name,
			starts_at: startsAt ?? null,
			ends_at: endsAt ?? null,
			late_penalty_per_minute: latePenalty
		}
	};
}

/** null for an empty field, undefined for one that is not in toISOString() format. */
function readUtcTime(data: FormData, key: string): string | null | undefined {
	const value = readString(data, key);
	if (!value) return null;
	const date = new Date(value);
	// Comparing as strings in the schema CHECK and in endsAt <= startsAt only holds for this exact format.
	return !Number.isNaN(date.getTime()) && date.toISOString() === value ? value : undefined;
}
