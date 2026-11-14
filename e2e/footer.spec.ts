import { expect, test } from '@playwright/test';

test('home footer links open in a new tab', async ({ page }) => {
	await page.goto('/');

	for (const [name, href] of [
		['Buy me a coffee', 'https://ko-fi.com/chechoxyz'],
		['See my other projects', 'https://checho.xyz']
	]) {
		const link = page.getByRole('link', { name: `${name} (opens in a new tab)` });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', href);
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	}
});
