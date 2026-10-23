import { env } from 'cloudflare:workers';
import { imageResponse } from '#lib/server/storage/image-store.js';
import type { RequestHandler } from './$types';

/** Reads no D1 rows: the random key is the secret, like a link token. */
export const GET: RequestHandler = ({ params }) =>
	imageResponse(env.IMAGES, `${params.game}/${params.file}`);
