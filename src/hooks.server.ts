import { env } from 'cloudflare:workers';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { measureD1Usage } from '#lib/server/d1-usage.js';
import { linkRateLimit, rejection, securityHeaders } from '#lib/server/request-guard.js';

// The load test plays a whole game in minutes, far faster per link than real players ever send.
const linkLimiter = env.LOADTEST_METRICS ? undefined : env.LINK_RATE_LIMITER;

const guard: Handle = async ({ event, resolve }) => {
	const early = rejection(event.request) ?? (await linkRateLimit(event.url, linkLimiter));
	if (early) return early;

	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(event.url))) {
		response.headers.set(name, value);
	}
	return response;
};

export const handle = env.LOADTEST_METRICS ? sequence(measureD1Usage, guard) : guard;
