import { expect, test, type Page } from '@playwright/test';
import { failOnCspViolations, watchCsp } from './csp.js';

// Creator accounts by email, from sign-up to signing in again. The dev server sends no email and
// shows the link and code on the page instead, so this runs only against the local server.

test.skip(
	!!process.env.HUNTBOARD_URL,
	'Needs the dev server, which shows the sign-in email on the page'
);

failOnCspViolations();

test('accounts: sign up with a code, create a game, sign out and back in with the link', async ({
	page
}) => {
	watchCsp(page);
	const stamp = Date.now();
	const email = `organiser-${stamp}@example.com`;
	const name = `Organiser ${stamp}`;
	const gameName = `Accounts ${stamp}`;

	await test.step('/new sends a visitor to sign in first', async () => {
		await page.goto('/new');
		await expect(page).toHaveURL(/\/login\?next=%2Fnew$/);
	});

	let code = '';
	await test.step('a wrong code is refused', async () => {
		code = await askForEmail(page, email);
		await page.getByLabel('Code').fill(code === '000000' ? '111111' : '000000');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('alert')).toHaveText(
			'That code is not right. Check the email and try again.'
		);
		await expect(page.getByLabel('Code')).toBeFocused();
		await expect(page).toHaveURL(/\/login\?next=%2Fnew$/);
	});

	await test.step('"Use a different email" still leads to /new', async () => {
		await page.getByRole('button', { name: 'Use a different email' }).click();
		code = await askForEmail(page, email);
	});

	await test.step('the right code asks a new address for a name, then lands on /new', async () => {
		await page.getByLabel('Code').fill(code);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.getByLabel('Your name').fill(name);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/new$/);
	});

	await test.step('create a game and find it on My games', async () => {
		await page.getByLabel('Game name').fill(gameName);
		await page.getByRole('button', { name: 'Create game' }).click();
		await expect(page).toHaveURL(/\/a\/[^/]+\/setup$/);

		await page.goto('/games');
		await expect(page.getByText(`Signed in as ${name} (${email}).`).first()).toBeVisible();
		await expect(page.getByRole('list', { name: 'My games' })).toContainText(gameName);
	});

	await test.step('sign out, then sign in with the emailed link', async () => {
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/$/);
		await page.goto('/games');
		await expect(page).toHaveURL(/\/login\?next=%2Fgames$/);

		await askForEmail(page, email.toUpperCase());
		const link = await page.getByRole('link', { name: 'Sign-in link' }).getAttribute('href');
		await page.goto(link ?? '');
		await expect(page.getByText(`Signing in as ${email}.`)).toBeVisible();
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/games$/);
		await expect(page.getByRole('list', { name: 'My games' })).toContainText(gameName);
	});

	await test.step('the link works only once', async () => {
		await page.goBack();
		await page.reload();
		await expect(page.getByRole('alert')).toHaveText(
			'This sign-in link has expired or was already used.'
		);
	});
});

/** Asks for a sign-in email and returns the code the dev server shows in its place. */
async function askForEmail(page: Page, email: string): Promise<string> {
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
	await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
	return (await page.getByTestId('preview-code').textContent()) ?? '';
}
