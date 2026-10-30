import { describe, expect, it, vi } from 'vitest';
import { resendSender } from './email.js';

const env = { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Huntboard <sign-in@example.com>' };
const email = { to: 'sam@example.com', subject: 'Sign in', text: 'Hello' };

describe('resendSender', () => {
	it('is null without an API key', () => {
		expect(resendSender({ ...env, RESEND_API_KEY: '' })).toBeNull();
	});

	it('posts the email to Resend with the key', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));

		expect(await resendSender(env, fetcher)?.(email)).toBe('sent');
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init?.headers).toMatchObject({ Authorization: 'Bearer re_test' });
		expect(JSON.parse(String(init?.body))).toEqual({
			from: 'Huntboard <sign-in@example.com>',
			to: ['sam@example.com'],
			subject: 'Sign in',
			text: 'Hello'
		});
	});

	it('reports a refused or failed send as failed', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 500 }));
		const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

		expect(await resendSender(env, refused)?.(email)).toBe('failed');
		expect(await resendSender(env, offline)?.(email)).toBe('failed');
	});

	it.each([
		['daily_quota_exceeded', 'daily-quota'],
		['monthly_quota_exceeded', 'monthly-quota'],
		['rate_limit_exceeded', 'failed']
	])(
		'tells a 429 %s apart, since a spent quota does not come back on a retry',
		async (name, outcome) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const body = JSON.stringify({ statusCode: 429, name, message: 'Refused' });
			const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 429 }));

			expect(await resendSender(env, fetcher)?.(email)).toBe(outcome);
		}
	);
});
