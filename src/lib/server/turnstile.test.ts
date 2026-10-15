import { describe, expect, it, vi } from 'vitest';
import { turnstileConfig, verifyTurnstile } from './turnstile.js';

const config = { siteKey: 'site-key', secretKey: 'secret-key' };
const context = { token: 'challenge-token', hostname: 'huntboard.example', ip: '192.0.2.1' };
const valid = { success: true, hostname: context.hostname, action: 'create-game' };

describe('turnstileConfig', () => {
	it('uses test keys only in development', () => {
		expect(turnstileConfig({}, true)?.siteKey).toBe('1x00000000000000000000AA');
		expect(turnstileConfig({}, false)).toBeNull();
	});

	it('rejects test keys in production', () => {
		const testConfig = turnstileConfig({}, true)!;
		expect(
			turnstileConfig(
				{ TURNSTILE_SITE_KEY: testConfig.siteKey, TURNSTILE_SECRET_KEY: testConfig.secretKey },
				false
			)
		).toBeNull();
	});

	it('requires both keys', () => {
		expect(turnstileConfig({ TURNSTILE_SITE_KEY: 'site-key' }, false)).toBeNull();
		expect(
			turnstileConfig(
				{ TURNSTILE_SITE_KEY: config.siteKey, TURNSTILE_SECRET_KEY: config.secretKey },
				false
			)
		).toEqual(config);
	});
});

describe('verifyTurnstile', () => {
	it('verifies the token with its secret and client IP', async () => {
		const fetcher = vi.fn().mockResolvedValue(Response.json(valid));
		expect(await verifyTurnstile(config, context, fetcher)).toBe('valid');
		expect(fetcher).toHaveBeenCalledWith(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					secret: config.secretKey,
					response: context.token,
					remoteip: context.ip
				}),
				signal: expect.any(AbortSignal)
			})
		);
	});

	it.each(['', 'x'.repeat(2049)])(
		'rejects an invalid token length without calling Cloudflare',
		async (token) => {
			const fetcher = vi.fn();
			expect(await verifyTurnstile(config, { ...context, token }, fetcher)).toBe('invalid');
			expect(fetcher).not.toHaveBeenCalled();
		}
	);

	it.each([
		{ ...valid, success: false, 'error-codes': ['timeout-or-duplicate'] },
		{ ...valid, hostname: 'other.example' },
		{ ...valid, action: 'other-form' },
		{ success: true },
		null
	])('rejects failed or mismatched verification: %j', async (result) => {
		expect(
			await verifyTurnstile(config, context, vi.fn().mockResolvedValue(Response.json(result)))
		).toBe('invalid');
	});

	it('accepts dummy verification metadata with development test keys', async () => {
		expect(
			await verifyTurnstile(
				turnstileConfig({}, true)!,
				context,
				vi
					.fn()
					.mockResolvedValue(Response.json({ ...valid, hostname: 'localhost', action: 'test' }))
			)
		).toBe('valid');
	});

	it.each([
		() => Promise.reject(new Error('network failure')),
		() => Promise.resolve(new Response('', { status: 503 })),
		() => Promise.resolve(new Response('invalid JSON')),
		() => Promise.resolve(Response.json({ success: false, 'error-codes': ['internal-error'] }))
	])('fails closed when verification is unavailable', async (fetcher) => {
		expect(await verifyTurnstile(config, context, fetcher)).toBe('unavailable');
	});
});
