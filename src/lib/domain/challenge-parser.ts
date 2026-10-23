import { collapseSpaces } from '../format/text.js';
import { CHALLENGE_MAX_POINTS } from './points.js';

export interface ParsedChallenge {
	title: string;
	description: string | null;
	section: string | null;
	min_points: number;
	max_points: number;
	/** Zero-based order among the accepted challenges. */
	position: number;
}

export interface ParseError {
	/** One-based line number in the pasted text. */
	line: number;
	message: string;
}

export interface ParseResult {
	challenges: ParsedChallenge[];
	errors: ParseError[];
}

type Line =
	| { kind: 'skip' }
	| { kind: 'heading'; text: string }
	| { kind: 'deep-heading' }
	| { kind: 'item'; indent: number; content: string; raw: string }
	| { kind: 'other-marker'; indent: number; raw: string }
	| { kind: 'text'; raw: string };

interface OpenItem {
	indent: number;
	descriptionLines: string[] | null;
}

interface Draft extends ParsedItem {
	section: string | null;
	descriptionLines: string[];
}

interface State {
	section: string | null;
	openItem: OpenItem | null;
	firstLineByTitle: Map<string, number>;
	drafts: Draft[];
	errors: ParseError[];
}

const NUMBER = String.raw`\d+(?:\.\d+)?`;
// An en or em dash is what a phone keyboard often types for "-", so it reads the same.
const POINTS = new RegExp(String.raw`\[\s*(${NUMBER})(?:\s*[-–—]\s*(${NUMBER}))?\s*\]$`);

export const NO_POINTS = 'No points found. End the line with points like [10] or [5-20]';
export const WRONG_MARKER = 'Start a challenge with a dash, like "- Swim [25]"';
export const WRONG_HEADING = 'Start a section with a single #, like "# Food"';
const NOT_UNDER_CHALLENGE = 'Not under a challenge. Start a challenge with a dash and a space';

/** Matches challenges the way re-import does: ignoring case and surrounding or repeated spaces. */
export function titleKey(title: string): string {
	return collapseSpaces(title).toLowerCase();
}

/** Parses pasted challenge text as described in docs/challenge-format.md. */
export function parseChallenges(text: string): ParseResult {
	const state: State = {
		section: null,
		openItem: null,
		firstLineByTitle: new Map(),
		drafts: [],
		errors: []
	};
	splitLines(text).forEach((raw, index) => handleLine(state, classify(raw), index + 1));
	return { challenges: state.drafts.map(toChallenge), errors: state.errors };
}

function toChallenge(draft: Draft, position: number): ParsedChallenge {
	return {
		title: draft.title,
		description: draft.descriptionLines.length > 0 ? draft.descriptionLines.join('\n') : null,
		section: draft.section,
		min_points: draft.min,
		max_points: draft.max,
		position
	};
}

function splitLines(text: string): string[] {
	return text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
}

function classify(raw: string): Line {
	const trimmed = raw.trim();
	if (trimmed === '') return { kind: 'skip' };

	const heading = /^#(?:\s+(.*))?$/.exec(trimmed);
	if (heading) return { kind: 'heading', text: heading[1] ?? '' };
	if (/^#{2,}(?:\s|$)/.test(trimmed)) return { kind: 'deep-heading' };

	const item = /^(\s*)-(?:\s+(.*))?$/.exec(raw);
	if (item) {
		const content = (item[2] ?? '').trim();
		// A notes app often leaves an empty bullet behind; it means nothing.
		if (content === '') return { kind: 'skip' };
		return { kind: 'item', indent: indentWidth(item[1]), content, raw: trimmed };
	}

	const otherMarker = /^(\s*)(?:[*+•]|\d+[.)])\s/.exec(raw);
	if (otherMarker)
		return { kind: 'other-marker', indent: indentWidth(otherMarker[1]), raw: trimmed };

	// "-Run [5]" or "– Run [5]" is a mistyped challenge, not description text.
	const mistypedDash = /^(\s*)[-–—]/.exec(raw);
	if (mistypedDash && POINTS.test(trimmed)) {
		return { kind: 'other-marker', indent: indentWidth(mistypedDash[1]), raw: trimmed };
	}

	return { kind: 'text', raw: trimmed };
}

function handleLine(state: State, line: Line, lineNumber: number): void {
	switch (line.kind) {
		case 'skip':
			return;
		case 'heading':
			state.openItem = null;
			state.section = collapseSpaces(line.text) || null;
			return;
		case 'deep-heading':
			state.openItem = null;
			state.errors.push({ line: lineNumber, message: WRONG_HEADING });
			return;
		case 'other-marker':
			if (isUnderOpenItem(state, line.indent)) {
				addDescription(state, line.raw, lineNumber);
			} else {
				rejectItem(state, WRONG_MARKER, line.indent, lineNumber);
			}
			return;
		case 'item':
			if (isUnderOpenItem(state, line.indent)) {
				addDescription(state, line.raw, lineNumber);
			} else {
				openItem(state, line.content, line.indent, lineNumber);
			}
			return;
		case 'text':
			addDescription(state, line.raw, lineNumber);
			return;
	}
}

function isUnderOpenItem(state: State, indent: number): boolean {
	return state.openItem !== null && indent > state.openItem.indent;
}

function addDescription(state: State, text: string, lineNumber: number): void {
	if (!state.openItem) {
		state.errors.push({ line: lineNumber, message: NOT_UNDER_CHALLENGE });
		return;
	}
	state.openItem.descriptionLines?.push(text);
}

function openItem(state: State, content: string, indent: number, lineNumber: number): void {
	const parsed = parseItem(content);
	if ('error' in parsed) return rejectItem(state, parsed.error, indent, lineNumber);
	const duplicate = duplicateError(state, parsed.title);
	if (duplicate) return rejectItem(state, duplicate, indent, lineNumber);

	const draft: Draft = { ...parsed, section: state.section, descriptionLines: [] };
	state.firstLineByTitle.set(titleKey(draft.title), lineNumber);
	state.drafts.push(draft);
	state.openItem = { indent, descriptionLines: draft.descriptionLines };
}

function rejectItem(state: State, message: string, indent: number, lineNumber: number): void {
	state.errors.push({ line: lineNumber, message });
	// Lines under a rejected item are still its description, so they must not raise errors of their own.
	state.openItem = { indent, descriptionLines: null };
}

function duplicateError(state: State, title: string): string | null {
	const firstLine = state.firstLineByTitle.get(titleKey(title));
	return firstLine === undefined ? null : `Duplicate title "${title}" (first on line ${firstLine})`;
}

interface ParsedItem {
	title: string;
	min: number;
	max: number;
}

function parseItem(content: string): ParsedItem | { error: string } {
	const match = POINTS.exec(content);
	if (!match) return { error: NO_POINTS };

	const [minText, maxText = minText] = [match[1], match[2]];
	if (minText.includes('.') || maxText.includes('.')) {
		return { error: 'Points must be whole numbers' };
	}
	const min = Number(minText);
	const max = Number(maxText);
	if (max > CHALLENGE_MAX_POINTS) {
		return { error: 'Points are too large' };
	}
	if (min > max) return { error: 'Min is greater than max' };

	const title = collapseSpaces(content.slice(0, match.index).replace(/[\s:\-–—]+$/, ''));
	if (title === '') return { error: 'No title found' };

	return { title, min, max };
}

function indentWidth(whitespace: string): number {
	return whitespace.replace(/\t/g, '    ').length;
}
