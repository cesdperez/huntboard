import { env } from 'cloudflare:workers';
import { Google } from 'arctic';
import type { GoogleClient } from '../use-cases/google-sign-in.js';

export const GOOGLE_CALLBACK_PATH = '/login/google/callback';

/** Google sign-in for this origin, or null when the client ID and secret are not configured. */
export function googleClient(url: URL): GoogleClient | null {
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
	return new Google(
		env.GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		new URL(GOOGLE_CALLBACK_PATH, url.origin).href
	);
}
