import { DEFAULT_IMAGE_LABEL, imageSrc, type GameImage } from '#lib/images.js';
import type { GameRow } from './db/types.js';

/** The game image as players see it, or null without one. */
export function gameImage(game: Pick<GameRow, 'image_key' | 'image_label'>): GameImage | null {
	if (!game.image_key) return null;
	return { src: imageSrc(game.image_key), label: game.image_label || DEFAULT_IMAGE_LABEL };
}
