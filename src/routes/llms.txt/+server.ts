import { HOME_DESCRIPTION } from '#lib/constants/homepage.js';
import { SITE_URL } from '#lib/constants/site.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(
		`# Huntboard

> ${HOME_DESCRIPTION}

## Public documentation

- [Huntboard homepage](${SITE_URL}): How to run a hunt, score claims, and share the scoreboard.
- [Huntboard in Markdown](${SITE_URL}index.md): The homepage information and frequently asked questions in plain text.

Game pages and uploaded media are shared through private links.
`,
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
	);
