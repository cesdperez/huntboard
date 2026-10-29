import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, rejection, securityHeaders } from './request-guard.js';

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

	it('lets large uploads through to the dev media route, only in dev', () => {
		const upload = () =>
			new Request('http://localhost:5173/dev/media/1/claims/abcdefghijklmnopqrstuv.mp4', {
				method: 'PUT',
				headers: { 'Content-Length': String(MAX_BODY_BYTES + 1) }
			});

		expect(rejection(upload(), { dev: true })).toBeNull();
		expect(rejection(upload(), { dev: false })?.status).toBe(413);
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

	it.each([
		'/a/tok',
		'/t/tok/__data.json',
		'/s/tok',
		'/login',
		'/login/google/callback',
		'/games',
		'/games/__data.json',
		'/new'
	])('keeps secret-link and account responses %s out of caches', (path) => {
		expect(securityHeaders(new URL(`https://huntboard.example${path}`))['Cache-Control']).toBe(
			'no-store'
		);
	});

	it.each(['/', '/logins', '/newest'])('leaves %s cacheable', (path) => {
		expect(
			securityHeaders(new URL(`https://huntboard.example${path}`))['Cache-Control']
		).toBeUndefined();
	});

	it('omits HSTS on plain HTTP', () => {
		expect(
			securityHeaders(new URL('http://localhost:4173/'))['Strict-Transport-Security']
		).toBeUndefined();
	});
});
