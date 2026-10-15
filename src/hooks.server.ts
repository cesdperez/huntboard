import { env } from 'cloudflare:workers';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { measureD1Usage } from '#lib/server/d1-usage.js';
import { rejection, securityHeaders } from '#lib/server/request-guard.js';

const guard: Handle = async ({ event, resolve }) => {
	const early = rejection(event.request);
	if (early) return early;

	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(event.url))) {
		response.headers.set(name, value);
	}
	return response;
};

export const handle = env.LOADTEST_METRICS ? sequence(measureD1Usage, guard) : guard;
