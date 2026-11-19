import { HOME_DESCRIPTION, HUNT_QUESTIONS, HUNT_STEPS } from '#lib/constants/homepage.js';
import { SITE_URL } from '#lib/constants/site.js';

export const LANDING_MARKDOWN = `# Huntboard

${HOME_DESCRIPTION}

## How a hunt runs

${HUNT_STEPS.map((step, index) => `${index + 1}. **${step.title}.** ${step.text}`).join('\n')}

## Frequently asked questions

${HUNT_QUESTIONS.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}

- [Create a game](${SITE_URL}new)
- [Enter a join code](${SITE_URL}join)
`;

function prefersMarkdown(request: Request) {
	if (request.method !== 'GET' && request.method !== 'HEAD') return false;
	const preferences = new Map<string, number>();
	for (const entry of (request.headers.get('Accept') ?? '').split(',')) {
		const [type, ...parameters] = entry
			.toLowerCase()
			.split(';')
			.map((part) => part.trim());
		const weight = parameters.find((part) => /^q\s*=/.test(part));
		const quality = weight === undefined ? 1 : Number(weight.slice(weight.indexOf('=') + 1));
		if (type && quality >= 0 && quality <= 1) {
			preferences.set(type, Math.max(preferences.get(type) ?? 0, quality));
		}
	}
	const markdown = preferences.get('text/markdown') ?? 0;
	const html =
		preferences.get('text/html') ?? preferences.get('text/*') ?? preferences.get('*/*') ?? 0;
	return markdown > 0 && markdown >= html;
}

export function markdownResponse(request: Request, response: Response, markdown: string) {
	if (response.status !== 200 && response.status !== 304) return response;
	if (
		response.status === 200 &&
		response.headers.get('Content-Type')?.split(';')[0] !== 'text/html'
	) {
		return response;
	}

	const headers = new Headers(response.headers);
	const vary = (headers.get('Vary') ?? '').split(',').map((value) => value.trim().toLowerCase());
	if (!vary.includes('*') && !vary.includes('accept')) headers.append('Vary', 'Accept');
	if (!prefersMarkdown(request))
		return new Response(response.body, { status: response.status, headers });

	for (const header of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified', 'Link']) {
		headers.delete(header);
	}
	headers.set('Content-Type', 'text/markdown; charset=utf-8');
	headers.set('Cache-Control', 'no-store');
	void response.body?.cancel();
	return new Response(request.method === 'HEAD' ? null : markdown, { headers });
}
