import { DEV_MEDIA_PATH } from '../storage/dev-media-upload.js';

/** The challenge list field allows 100,000 characters; this leaves room for multi-byte, URL-encoded text. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// Secret links, and pages that show who is signed in.
const PRIVATE_PATH = /^\/(?:[ats]\/[^/]+|login|games|new)(?:\/|$)/;
const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEV_PATH = /^\/dev(?:\/|$)/;

/** A response that ends the request before routing, or null to continue. */
export function rejection(request: Request, { dev } = { dev: false }): Response | null {
	const url = new URL(request.url);
	if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
		url.protocol = 'https:';
		return new Response(null, { status: 308, headers: { Location: url.href } });
	}
	// Every method, so a 405 listing the allowed ones never shows that a dev route exists.
	if (!dev && DEV_PATH.test(url.pathname)) return new Response('Not found', { status: 404 });
	if (BODYLESS_METHODS.has(request.method)) return null;

	const length = request.headers.get('Content-Length');
	if (length === null) return new Response('Length required', { status: 411 });
	// In production, claim media goes straight to R2 and never through the Worker.
	if (dev && url.pathname.startsWith(DEV_MEDIA_PATH)) return null;
	if (!(Number(length) <= MAX_BODY_BYTES)) {
		return new Response('Request body too large', { status: 413 });
	}
	return null;
}

/** Headers for every dynamic response. CSP is set by SvelteKit so it can add nonces. */
export function securityHeaders(url: URL): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		// Admin, team, and scoreboard links carry their token in the path.
		// Not no-referrer: Chrome then sends Origin: null on plain form posts and SvelteKit's CSRF check rejects them.
		'Referrer-Policy': 'same-origin',
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'X-Robots-Tag': 'noindex, nofollow'
	};
	if (url.protocol === 'https:') {
		headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	}
	if (PRIVATE_PATH.test(url.pathname)) {
		headers['Cache-Control'] = 'no-store';
	}
	return headers;
}
