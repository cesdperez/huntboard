import { env } from 'cloudflare:workers';
import { deleteAllMedia } from '#lib/server/use-cases/claim-media.js';
import { adminAction } from './admin-action.js';
import type { AdminActions } from './types.js';

/** Setup tab actions. Names start with "media" so they cannot collide with other sections. */
export const mediaActions = {
	mediaDeleteAll: adminAction('media', (db, gameId) => deleteAllMedia(db, env.MEDIA, gameId))
} satisfies AdminActions;
