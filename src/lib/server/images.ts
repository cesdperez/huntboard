import { GAME_IMAGE_MAX_BYTES, IMAGE_LABEL_ERROR, IMAGE_LABEL_MAX_LENGTH } from '#lib/images.js';
import { collapseSpaces } from '#lib/text.js';
import type { ActionOutcome } from './action-outcome.js';
import { resetGame } from './db/games.js';
import { setGameImage, setGameImageLabel, setTeamAvatar } from './db/images.js';
import { deleteTeam, type DeleteTeamResult } from './db/teams.js';
import type { GameRow } from './db/types.js';
import { deleteGameImages, deleteImages, replaceImage, type ImageBucket } from './image-store.js';
import { readImageUpload } from './image-upload.js';
import { readString } from './form.js';

/** What the game image actions put under page.form.gameImage. */
export interface GameImageFormResult {
	saved?: true;
	error?: string;
}

type GameImageOutcome = ActionOutcome<GameImageFormResult>;

/** Saves a new image with its label, or only the label when no file is sent. */
export async function saveGameImage(
	db: D1Database,
	bucket: ImageBucket,
	game: GameRow,
	data: FormData
): Promise<GameImageOutcome> {
	const label = collapseSpaces(readString(data, 'label'));
	const fail = (error: string) => ({ status: 400, result: { error } });
	if (label.length > IMAGE_LABEL_MAX_LENGTH) return fail(IMAGE_LABEL_ERROR);

	const read = await readImageUpload(data, 'image', GAME_IMAGE_MAX_BYTES);
	if (read.status === 'invalid') return fail(read.message);
	if (read.status === 'missing') {
		if (!game.image_key) return fail('Choose an image first.');
		await setGameImageLabel(db, game.id, label);
	} else {
		await replaceImage(bucket, game.id, read.upload, (key) =>
			setGameImage(db, game.id, key, label)
		);
	}
	return { status: 200, result: { saved: true } };
}

export async function removeGameImage(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number
): Promise<void> {
	const replaced = await setGameImage(db, gameId, null, '');
	await deleteImages(bucket, [replaced?.previous ?? null]);
}

/** False when the team is not in this game. */
export async function removeTeamAvatar(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number,
	teamId: number
): Promise<boolean> {
	const replaced = await setTeamAvatar(db, gameId, teamId, null);
	if (!replaced) return false;
	await deleteImages(bucket, [replaced.previous]);
	return true;
}

export async function deleteTeamWithAvatar(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number,
	teamId: number
): Promise<DeleteTeamResult['status']> {
	const result = await deleteTeam(db, gameId, teamId);
	if (result.status === 'deleted') await deleteImages(bucket, [result.avatarKey]);
	return result.status;
}

/** resetGame, then a sweep of every image stored under the game, orphans included. */
export async function resetGameWithImages(
	db: D1Database,
	bucket: ImageBucket,
	gameId: number
): Promise<GameRow> {
	const game = await resetGame(db, gameId);
	await deleteGameImages(bucket, gameId);
	return game;
}
