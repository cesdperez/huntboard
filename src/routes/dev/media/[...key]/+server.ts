import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import { storeDevUpload } from '#lib/server/storage/dev-media-upload.js';
import type { RequestHandler } from './$types';

/** Stands in for the R2 presigned PUT under `pnpm dev`. */
export const PUT: RequestHandler = ({ params, request }) => {
	if (!dev) error(404, 'Not found');
	return storeDevUpload(env.MEDIA, request, params.key, new Date());
};
