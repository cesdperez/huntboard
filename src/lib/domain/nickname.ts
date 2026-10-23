import { normalizeName } from './name.js';

/** Shared by the browser prompt and the server check, so both agree on what a nickname is. */
export const NICKNAME_MAX_LENGTH = 40;

export const normalizeNickname = (value: unknown) => normalizeName(value, NICKNAME_MAX_LENGTH);
