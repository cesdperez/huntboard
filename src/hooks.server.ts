import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { LANDING_MARKDOWN, markdownResponse } from '#lib/server/http/markdown.js';
import { measureD1Usage } from '#lib/server/http/d1-usage.js';
import { analyticsHead, rejection, securityHeaders } from '#lib/server/http/request-guard.js';
import { htmlAttributes, resolveAppearance } from '#lib/themes/index.js';

const guard: Handle = async ({ event, resolve }) => {
	const response = rejection(event.request, { dev }) ?? (await resolve(event));
	for (const [name, value] of Object.entries(securityHeaders(event.url, response.status))) {
		response.headers.set(name, value);
	}
	return event.url.pathname === '/'
		? markdownResponse(event.request, response, LANDING_MARKDOWN)
		: response;
};

// On <html> from the first byte, so the page never paints in another theme and portalled sheets match.
const theme: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace(
					'%huntboard.theme%',
					htmlAttributes(resolveAppearance(event.locals.gameTheme, event.locals.colorMode))
				)
				.replace('</head>', `${analyticsHead(event.url.pathname)}</head>`)
	});

export const handle = env.LOADTEST_METRICS
	? sequence(measureD1Usage, guard, theme)
	: sequence(guard, theme);
