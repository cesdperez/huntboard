import { env } from 'cloudflare:workers';
import { mediaResponse } from '#lib/server/storage/media-store.js';
import type { RequestHandler } from './$types';

/** Reads no D1 rows: the random key is the secret, like a link token. */
export const GET: RequestHandler = ({ params, request }) =>
	mediaResponse(env.MEDIA, `${params.game}/claims/${params.file}`, request.headers.get('Range'));
