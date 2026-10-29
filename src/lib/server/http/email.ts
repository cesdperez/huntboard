import type { SendEmail } from '../use-cases/email-sign-in.js';

const RESEND_URL = 'https://api.resend.com/emails';

/** Sends through Resend's API, or null when RESEND_API_KEY is not set. */
export function resendSender(
	env: Pick<Cloudflare.Env, 'RESEND_API_KEY' | 'EMAIL_FROM'>,
	fetcher: typeof fetch = fetch
): SendEmail | null {
	const key = env.RESEND_API_KEY;
	if (!key) return null;
	return async ({ to, subject, text }) => {
		try {
			const response = await fetcher(RESEND_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text })
			});
			if (response.ok) return true;
			console.error(`Resend refused a sign-in email: ${response.status} ${await response.text()}`);
		} catch (error) {
			console.error('Resend could not be reached', error);
		}
		return false;
	};
}
