import { env } from 'cloudflare:workers';
import { linkRateLimit, rejection, securityHeaders } from '#lib/server/request-guard.js';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	const early = rejection(event.request) ?? (await linkRateLimit(event.url, env.LINK_RATE_LIMITER));
	if (early) return early;

	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(event.url))) {
		response.headers.set(name, value);
	}
	return response;
};
