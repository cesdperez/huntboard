/** Limits shared by the browser, which resizes before upload, and the server, which checks the result. */
export const AVATAR_SIZE = 256;
export const GAME_IMAGE_LONG_EDGE = 1600;
// Both stay under MAX_BODY_BYTES in request-guard.ts, with room for the rest of the form.
export const AVATAR_MAX_BYTES = 256 * 1024;
export const GAME_IMAGE_MAX_BYTES = 1536 * 1024;

export const IMAGE_LABEL_MAX_LENGTH = 40;
export const IMAGE_LABEL_ERROR = `Keep the label to at most ${IMAGE_LABEL_MAX_LENGTH} characters.`;
/** Names a game image whose label is blank. */
export const DEFAULT_IMAGE_LABEL = 'Game image';

/** The game image as players and the scoreboard see it. */
export interface GameImage {
	src: string;
	/** Never blank: also the alt text. */
	label: string;
}

export function imageSrc(key: string): string {
	return `/images/${key}`;
}

/** The fallback shown in place of a team picture. */
export function initialOf(name: string): string {
	const [first] = new Intl.Segmenter().segment(name.trim());
	return first ? first.segment.toUpperCase() : '';
}
