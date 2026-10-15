/** The challenge list field allows 100,000 characters; this leaves room for multi-byte, URL-encoded text. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SECRET_LINK_PATH = /^\/[ats]\/([^/]+)/;
const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** A response that ends the request before routing, or null to continue. */
export function rejection(request: Request): Response | null {
	const url = new URL(request.url);
	if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
		url.protocol = 'https:';
		return new Response(null, { status: 308, headers: { Location: url.href } });
	}
	if (BODYLESS_METHODS.has(request.method)) return null;

	const length = request.headers.get('Content-Length');
	if (length === null) return new Response('Length required', { status: 411 });
	if (!(Number(length) <= MAX_BODY_BYTES)) {
		return new Response('Request body too large', { status: 413 });
	}
	return null;
}

type LinkRateLimiter = Pick<RateLimit, 'limit'>;

/**
 * Caps requests per admin, team or scoreboard link, so one leaked link cannot spend the daily
 * database allowance. Runs before routing, so a rejected request never reaches the database.
 */
export async function linkRateLimit(
	url: URL,
	limiter: LinkRateLimiter | undefined
): Promise<Response | null> {
	const token = SECRET_LINK_PATH.exec(url.pathname)?.[1];
	if (!token || !limiter) return null;
	try {
		const { success } = await limiter.limit({ key: `huntboard:link:${token}` });
		if (success) return null;
	} catch {
		// A limiter outage must not stop a running game; the edge rule still applies.
		return null;
	}
	return new Response('Too many requests. Wait a minute and try again.', {
		status: 429,
		headers: { 'Retry-After': '60' }
	});
}

/** Headers for every dynamic response. CSP is set by SvelteKit so it can add nonces. */
export function securityHeaders(url: URL): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		// Admin, team, and scoreboard links carry their token in the path.
		'Referrer-Policy': 'no-referrer',
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'X-Robots-Tag': 'noindex, nofollow'
	};
	if (url.protocol === 'https:') {
		headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	}
	if (SECRET_LINK_PATH.test(url.pathname)) {
		headers['Cache-Control'] = 'no-store';
	}
	return headers;
}
