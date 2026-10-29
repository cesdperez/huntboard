import type { Page } from '@playwright/test';

/**
 * Opens /new signed in. Locally it uses the dev server's test sign-in. Against a deployment, which
 * has no test sign-in, it uses HUNTBOARD_SESSION: a session cookie copied from a real sign-in.
 */
export async function openNewGameSignedIn(page: Page, name: string): Promise<void> {
	const deployment = process.env.HUNTBOARD_URL;
	if (!deployment) {
		await page.goto(`/dev/sign-in?name=${encodeURIComponent(name)}&next=/new`);
		return;
	}
	const session = process.env.HUNTBOARD_SESSION;
	if (!session) throw new Error('Set HUNTBOARD_SESSION to rehearse against HUNTBOARD_URL');
	await page.context().addCookies([
		{
			name: 'session',
			value: session,
			url: deployment,
			httpOnly: true,
			secure: true,
			sameSite: 'Lax'
		}
	]);
	await page.goto('/new');
}
