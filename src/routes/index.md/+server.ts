import { SITE_URL } from '#lib/constants/site.js';
import { LANDING_MARKDOWN } from '#lib/server/http/markdown.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(LANDING_MARKDOWN, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			Link: `<${SITE_URL}>; rel="canonical"`
		}
	});
