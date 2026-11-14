import { expect, test } from '@playwright/test';

test('contour fonts load from the app origin', async ({ page }) => {
	const fontUrls: string[] = [];
	page.on('request', (request) => {
		if (request.resourceType() === 'font') fontUrls.push(request.url());
	});
	await page.goto('/');
	const fonts = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...document.fonts]
			.filter((font) => font.status === 'loaded')
			.map((font) => font.family);
	});
	expect(fonts).toContain('Instrument Sans Variable');
	expect(fonts).toContain('Big Shoulders Variable');
	expect(fontUrls.length).toBeGreaterThan(0);
	expect(fontUrls.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});

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
