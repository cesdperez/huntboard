import { describe, expect, it } from 'vitest';
import { linkRateLimit, MAX_BODY_BYTES, rejection, securityHeaders } from './request-guard.js';

function post(url: string, headers: Record<string, string> = {}) {
	return new Request(url, { method: 'POST', headers });
}

describe('rejection', () => {
	it('redirects plain HTTP to HTTPS', () => {
		const response = rejection(new Request('http://huntboard.example/t/abc?x=1'));
		expect(response?.status).toBe(308);
		expect(response?.headers.get('Location')).toBe('https://huntboard.example/t/abc?x=1');
	});

	it('serves plain HTTP on loopback hosts for local previews', () => {
		expect(rejection(new Request('http://localhost:4173/'))).toBeNull();
		expect(rejection(new Request('http://127.0.0.1:4173/'))).toBeNull();
	});

	it('rejects bodies over the limit before they are parsed', () => {
		const response = rejection(
			post('https://huntboard.example/new', { 'Content-Length': String(MAX_BODY_BYTES + 1) })
		);
		expect(response?.status).toBe(413);
	});

	it('requires a declared length on bodies', () => {
		expect(rejection(post('https://huntboard.example/new'))?.status).toBe(411);
	});

	it('lets reads and bodies within the limit through', () => {
		expect(rejection(new Request('https://huntboard.example/'))).toBeNull();
		expect(
			rejection(post('https://huntboard.example/new', { 'Content-Length': String(MAX_BODY_BYTES) }))
		).toBeNull();
	});
});

describe('securityHeaders', () => {
	it('sends browser hardening headers on every response', () => {
		const headers = securityHeaders(new URL('https://huntboard.example/'));
		expect(headers['X-Content-Type-Options']).toBe('nosniff');
		expect(headers['X-Frame-Options']).toBe('DENY');
		expect(headers['Referrer-Policy']).toBe('no-referrer');
		expect(headers['Strict-Transport-Security']).toContain('max-age=');
		expect(headers['Permissions-Policy']).toContain('camera=()');
		expect(headers['X-Robots-Tag']).toBe('noindex, nofollow');
		expect(headers['Cache-Control']).toBeUndefined();
	});

	it.each(['/a/tok', '/t/tok/__data.json', '/s/tok'])(
		'keeps secret-link responses %s out of caches',
		(path) => {
			expect(securityHeaders(new URL(`https://huntboard.example${path}`))['Cache-Control']).toBe(
				'no-store'
			);
		}
	);

	it('omits HSTS on plain HTTP', () => {
		expect(
			securityHeaders(new URL('http://localhost:4173/'))['Strict-Transport-Security']
		).toBeUndefined();
	});
});

describe('linkRateLimit', () => {
	function limiter(success: boolean) {
		const keys: string[] = [];
		return {
			keys,
			limit: async ({ key }: { key: string }) => {
				keys.push(key);
				return { success };
			}
		};
	}

	it.each(['/a/tok/queue', '/t/tok/__data.json', '/s/tok'])(
		'counts every request to %s against its link',
		async (path) => {
			const counter = limiter(true);
			expect(await linkRateLimit(new URL(`https://huntboard.example${path}`), counter)).toBeNull();
			expect(counter.keys).toEqual(['huntboard:link:tok']);
		}
	);

	it('rejects a link over its limit before the database is read', async () => {
		const response = await linkRateLimit(
			new URL('https://huntboard.example/t/tok'),
			limiter(false)
		);
		expect(response?.status).toBe(429);
		expect(response?.headers.get('Retry-After')).toBe('60');
	});

	it('leaves other pages to the edge rule', async () => {
		const counter = limiter(false);
		expect(await linkRateLimit(new URL('https://huntboard.example/new'), counter)).toBeNull();
		expect(counter.keys).toEqual([]);
	});

	it('serves the game when the limiter is missing or fails', async () => {
		const url = new URL('https://huntboard.example/t/tok');
		expect(await linkRateLimit(url, undefined)).toBeNull();
		const broken = { limit: async () => Promise.reject(new Error('down')) };
		expect(await linkRateLimit(url, broken)).toBeNull();
	});
});
