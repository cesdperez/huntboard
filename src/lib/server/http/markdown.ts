export const LANDING_MARKDOWN = `# Huntboard

Run a scavenger hunt with a live scoreboard. Teams claim challenges from their phones. You judge each claim with its photo or video, and everyone follows the leaderboard as it changes.

1. Write your challenges and set a points range, start and end times, and a late penalty if needed.
2. Send each team its private link or QR code. Players choose a nickname and start.
3. Judge claims as they arrive and award points or reject each claim with a reason.
4. Show the scoreboard at the finish.

- [Create a game](/new)
- [Enter a join code](/join)
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
	headers.set('Content-Signal', 'ai-train=no, search=no, ai-input=no');
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
