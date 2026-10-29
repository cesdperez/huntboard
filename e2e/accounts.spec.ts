import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Creator accounts with passkeys, from sign-up to a second passkey. A virtual authenticator stands
// in for the phone's, so the real WebAuthn ceremony runs in the browser and on the server.

test.skip(
	!!process.env.HUNTBOARD_URL,
	'Creates accounts, so it runs only against the local server'
);

const cspViolations: string[] = [];

test.afterEach(() => {
	expect(cspViolations).toEqual([]);
});

test('accounts: sign up with a passkey, create a game, sign out and back in', async ({
	browser
}) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) cspViolations.push(message.text());
	});
	await addVirtualAuthenticator(context, page);
	const name = `Organiser ${Date.now()}`;
	const gameName = `Accounts ${Date.now()}`;

	await test.step('/new sends a visitor to sign in first', async () => {
		await page.goto('/new');
		await expect(page).toHaveURL(/\/login\?next=%2Fnew$/);
	});

	await test.step('sign up with a passkey and land back on /new', async () => {
		await page.getByLabel('Your name').fill(name);
		await page.getByRole('button', { name: 'Create account with a passkey' }).click();
		await expect(page).toHaveURL(/\/new$/);
	});

	await test.step('create a game and find it on My games', async () => {
		await page.getByLabel('Game name').fill(gameName);
		await page.getByRole('button', { name: 'Create game' }).click();
		await expect(page).toHaveURL(/\/a\/[^/]+\/setup$/);
		await expect(page.getByRole('heading', { name: 'My games' })).toHaveCount(0);

		await page.goto('/games');
		await expect(page.getByText(`Signed in as ${name}.`).first()).toBeVisible();
		await expect(page.getByRole('list', { name: 'My games' })).toContainText(gameName);
	});

	await test.step('the same authenticator cannot add a second passkey', async () => {
		await page.getByRole('button', { name: 'Add a passkey' }).click();
		await expect(page.getByRole('alert')).toHaveText(
			'This device already has a passkey for your account.'
		);
	});

	await test.step('sign out, then sign in with the passkey', async () => {
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/$/);
		await page.goto('/games');
		await expect(page).toHaveURL(/\/login\?next=%2Fgames$/);

		await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
		await expect(page).toHaveURL(/\/games$/);
		await expect(page.getByRole('list', { name: 'My games' })).toContainText(gameName);
	});

	await test.step('a security key is added as a second way to sign in', async () => {
		await addVirtualAuthenticator(context, page, 'usb');
		await page.getByRole('button', { name: 'Add a passkey' }).click();
		await expect(
			page.getByRole('list', { name: 'Ways to sign in' }).getByRole('listitem')
		).toHaveCount(2);
	});
});

/** An authenticator that verifies the user and stores passkeys: a phone's, or a security key. */
async function addVirtualAuthenticator(
	context: BrowserContext,
	page: Page,
	transport: 'internal' | 'usb' = 'internal'
) {
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport,
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
}
