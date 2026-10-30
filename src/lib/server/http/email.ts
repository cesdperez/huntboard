import type { SendEmail, SendOutcome } from '../use-cases/email-sign-in.js';

const RESEND_URL = 'https://api.resend.com/emails';

// Resend answers 429 for these and for its per-second rate limit, which a retry gets past.
const QUOTA_ERRORS = new Map<string, SendOutcome>([
	['daily_quota_exceeded', 'daily-quota'],
	['monthly_quota_exceeded', 'monthly-quota']
]);

/** Sends through Resend's API, or null when RESEND_API_KEY is not set. */
export function resendSender(
	env: Pick<Cloudflare.Env, 'RESEND_API_KEY' | 'EMAIL_FROM'>,
	fetcher: typeof fetch = fetch
): SendEmail | null {
	const key = env.RESEND_API_KEY;
	if (!key) return null;
	return async ({ to, subject, text, html }) => {
		try {
			const response = await fetcher(RESEND_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html })
			});
			if (response.ok) return 'sent';
			const body = await response.text();
			console.error(`Resend refused a sign-in email: ${response.status} ${body}`);
			return (response.status === 429 && QUOTA_ERRORS.get(errorName(body))) || 'failed';
		} catch (error) {
			console.error('Resend could not be reached', error);
		}
		return 'failed';
	};
}

function errorName(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body);
		return typeof parsed === 'object' && parsed !== null && 'name' in parsed
			? String(parsed.name)
			: '';
	} catch {
		return '';
	}
}
