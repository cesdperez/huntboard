import { collapseSpaces } from './text.js';

/** Shared by reject and adjustment reasons and their server checks. A reason is a line, not a letter. */
export const REASON_MAX_LENGTH = 200;

export const REASON_TOO_LONG = `Keep the reason to at most ${REASON_MAX_LENGTH} characters.`;

/** A reason as stored: one line, so the same text typed in either form reads the same. */
export const normalizeReason = collapseSpaces;
