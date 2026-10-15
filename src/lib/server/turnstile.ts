interface TurnstileEnv {
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
}

interface TurnstileConfig {
	siteKey: string;
	secretKey: string;
}

const TEST_SITE_KEY = '1x00000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

/** Development uses Cloudflare test keys. Production requires real keys. */
export function turnstileConfig(env: TurnstileEnv, dev: boolean): TurnstileConfig | null {
	if (dev) return { siteKey: TEST_SITE_KEY, secretKey: TEST_SECRET_KEY };
	const siteKey = env.TURNSTILE_SITE_KEY?.trim();
	const secretKey = env.TURNSTILE_SECRET_KEY?.trim();
	if (!siteKey || !secretKey) return null;
	if (!dev && [siteKey, secretKey].some((key) => /^[123]x0{20}/.test(key))) return null;
	return { siteKey, secretKey };
}

/** Validates a single-use token and binds it to this form and hostname. */
export async function verifyTurnstile(
	config: TurnstileConfig,
	{ token, hostname, ip }: { token: string; hostname: string; ip: string },
	fetcher: typeof fetch
): Promise<'valid' | 'invalid' | 'unavailable'> {
	if (!token || token.length > 2048) return 'invalid';
	try {
		const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ secret: config.secretKey, response: token, remoteip: ip }),
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) return 'unavailable';
		const result = (await response.json()) as {
			success?: boolean;
			hostname?: string;
			action?: string;
			'error-codes'?: string[];
		} | null;
		if (
			result?.['error-codes']?.some((code) =>
				['internal-error', 'invalid-input-secret', 'missing-input-secret'].includes(code)
			)
		)
			return 'unavailable';
		if (result?.success !== true) return 'invalid';
		// Dummy verification returns fixed metadata instead of the widget's hostname and action.
		if (config.secretKey === TEST_SECRET_KEY) return 'valid';
		return result.hostname === hostname && result.action === 'create-game' ? 'valid' : 'invalid';
	} catch {
		return 'unavailable';
	}
}
