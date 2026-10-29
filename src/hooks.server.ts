import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { measureD1Usage } from '#lib/server/http/d1-usage.js';
import { rejection, securityHeaders } from '#lib/server/http/request-guard.js';
import { htmlAttributes, resolveAppearance } from '#lib/themes/index.js';

const guard: Handle = async ({ event, resolve }) => {
	const early = rejection(event.request, { dev });
	if (early) return early;

	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders(event.url))) {
		response.headers.set(name, value);
	}
	return response;
};

// On <html> from the first byte, so the page never paints in another theme and portalled sheets match.
const theme: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(
				'%huntboard.theme%',
				htmlAttributes(resolveAppearance(event.locals.gameTheme, event.locals.colorMode))
			)
	});

export const handle = env.LOADTEST_METRICS
	? sequence(measureD1Usage, guard, theme)
	: sequence(guard, theme);
