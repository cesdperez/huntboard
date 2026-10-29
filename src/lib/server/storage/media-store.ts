import { MEDIA_EXTENSIONS, type MediaType } from '#lib/domain/claim-media.js';
import { generateToken } from '#lib/domain/token.js';

export type MediaBucket = Pick<R2Bucket, 'put' | 'get' | 'head' | 'delete' | 'list'>;

/** Keys start with the game id, so the game's sweep covers them, and the random name is the secret. */
export function newMediaKey(gameId: number, type: MediaType): string {
	return `${gameId}/claims/${generateToken()}.${MEDIA_EXTENSIONS[type]}`;
}
