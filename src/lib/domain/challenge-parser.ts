import { collapseSpaces } from '../text.js';

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
	| { kind: 'item'; indent: number; content: string; raw: string }
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
const RANGE = String.raw`(${NUMBER})(?:\s*[-–—]\s*(${NUMBER}))?`;
const UNIT = String.raw`(?:pts?|points?)\.?`;
const POINTS_PATTERNS = [
	new RegExp(String.raw`[[(]\s*${RANGE}(?:\s*${UNIT})?\s*[\])]$`, 'i'),
	new RegExp(String.raw`(?:^|[\s:])${RANGE}\s*${UNIT}$`, 'i'),
	// A colon between two digits is a clock time (16:00), not points.
	new RegExp(String.raw`(?:(?<!\d):\s*|:\s+)${RANGE}$`)
];

const NOT_UNDER_CHALLENGE =
	'Not under a challenge. Start a challenge with -, *, + or a number followed by a space';

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
	if (trimmed === '' || isHorizontalRule(trimmed)) return { kind: 'skip' };

	const heading = /^#{1,6}(?:\s+(.*))?$/.exec(trimmed);
	if (heading) return { kind: 'heading', text: stripClosingHashes(heading[1] ?? '') };

	const item = /^(\s*)(?:[-*+]|\d+[.)])(?:\s+(.*))?$/.exec(raw);
	if (item) {
		const content = stripCheckbox((item[2] ?? '').trim());
		// A notes app often leaves an empty bullet behind; it means nothing.
		if (content === '') return { kind: 'skip' };
		return { kind: 'item', indent: indentWidth(item[1]), content, raw: trimmed };
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
		case 'item':
			if (state.openItem && line.indent > state.openItem.indent) {
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
	const match = findPoints(content);
	if (!match) return { error: 'No points found' };

	const [minText, maxText = minText] = [match[1], match[2]];
	if (minText.includes('.') || maxText.includes('.')) {
		return { error: 'Points must be whole numbers' };
	}
	const min = Number(minText);
	const max = Number(maxText);
	if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
		return { error: 'Points are too large' };
	}
	if (min > max) return { error: 'Min is greater than max' };

	const title = collapseSpaces(content.slice(0, match.index).replace(/[\s:\-–—]+$/, ''));
	if (title === '') return { error: 'No title found' };

	return { title, min, max };
}

function findPoints(content: string): RegExpExecArray | null {
	for (const pattern of POINTS_PATTERNS) {
		const match = pattern.exec(content);
		if (match) return match;
	}
	return null;
}

function isHorizontalRule(trimmed: string): boolean {
	return /^([-*_])(?:\s*\1){2,}$/.test(trimmed);
}

function stripClosingHashes(text: string): string {
	return text.replace(/(?:^|\s+)#+\s*$/, '').trim();
}

function stripCheckbox(content: string): string {
	return content.replace(/^\[[ xX]\](?:\s+|$)/, '');
}

function indentWidth(whitespace: string): number {
	return whitespace.replace(/\t/g, '    ').length;
}
