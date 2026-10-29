import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { devPresigner } from '#lib/server/storage/dev-media-upload.js';
import { r2Presigner, type MediaPresigner } from '#lib/server/storage/media-upload.js';

/** R2 when its secrets are set, the dev route under `pnpm dev`, and otherwise null: never a fallback in production. */
export function mediaPresigner(): MediaPresigner | null {
	const { R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = env;
	if (accessKeyId && secretAccessKey) return r2Presigner({ accessKeyId, secretAccessKey });
	if (dev) return devPresigner;
	console.error('Claim media uploads are off: set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
	return null;
}
