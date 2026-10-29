import { expect, test, type Browser, type Page } from '@playwright/test';
import { failOnCspViolations, watchCsp } from './csp.js';
import { openNewGameSignedIn } from './sign-in.js';

// The game image and team pictures from upload to removal: resized in the browser, served with a
// long cache lifetime, and gone from storage once removed or reset.

failOnCspViolations();

test('images: game image and team pictures, from upload to reset', async ({ browser }) => {
	test.setTimeout(90_000);
	const admin = await open(browser, 'Image judge');

	await test.step('create a game with two teams', async () => {
		await openNewGameSignedIn(admin, 'Image judge');
		await admin.getByLabel('Game name').fill(`Rehearsal images ${Date.now()}`);
		await admin.getByRole('button', { name: 'Create game' }).click();
		await expect(admin).toHaveURL(/\/a\/[^/]+\/setup$/);
		for (const name of ['Canal Rats', 'Night Owls']) {
			await admin.getByLabel('New team').fill(name);
			await admin.getByRole('button', { name: 'Add team' }).click();
			await expect(admin.getByRole('list', { name: /^Teams in/ })).toContainText(name);
		}
	});

	await test.step('the admin saves a portrait game image, shrunk to 1600 pixels high', async () => {
		await admin.getByLabel('Image', { exact: true }).setInputFiles(await png(admin, 2400, 3200));
		await admin.getByLabel('Label').fill('Birthday invitation');
		await admin.getByRole('button', { name: 'Save image' }).click();
		await expect(admin.getByText('Saved.')).toBeVisible();
		const preview = admin.getByRole('img', { name: 'Birthday invitation' });
		await expect(preview).toBeVisible();
		expect(await naturalSize(preview)).toEqual({ width: 1200, height: 1600 });
	});

	const gameImageSrc = await admin
		.getByRole('img', { name: 'Birthday invitation' })
		.getAttribute('src');
	await test.step('the image is served as WebP, cached for a year', async () => {
		const response = await admin.request.get(gameImageSrc!);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('image/webp');
		expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
	});

	const scoreboardUrl = await admin.getByLabel('Scoreboard', { exact: true }).inputValue();
	const ratsUrl = await admin.getByLabel('Canal Rats', { exact: true }).inputValue();
	const rats = await open(browser, 'Rat player');
	await rats.goto(ratsUrl);

	await test.step('players see the image above the strip and open it in full', async () => {
		const full = rats.getByRole('dialog').getByRole('img', { name: 'Birthday invitation' });
		// A tap before the page hydrates does nothing, so tap again until the sheet opens.
		await expect(async () => {
			await rats.getByRole('button', { name: 'View Birthday invitation' }).click();
			await expect(full).toBeVisible({ timeout: 1000 });
		}).toPass();
		await rats.getByRole('button', { name: 'Close' }).click();
		await expect(rats.getByRole('dialog')).toBeHidden();
	});

	await test.step('a team refuses a file the browser cannot read', async () => {
		await rats.getByRole('button', { name: /Show the scoreboard/ }).click();
		await pick(rats, 'Add picture', {
			name: 'notes.png',
			mimeType: 'image/png',
			buffer: Buffer.from('not an image')
		});
		await expect(rats.getByRole('alert')).toHaveText(
			'This file is not an image this browser can read. Choose a JPEG, PNG or WebP image.'
		);
	});

	await test.step('a team adds a picture, cropped square to 256 pixels', async () => {
		await pick(rats, 'Add picture', await png(rats, 900, 600));
		await expect(rats.getByRole('status').filter({ hasText: 'Picture saved' })).toBeVisible();
		await expect(rats.getByRole('button', { name: 'Change picture' })).toBeVisible();
		const avatar = rats.locator('#team-standings img').first();
		await expect(avatar).toBeVisible();
		expect(await naturalSize(avatar)).toEqual({ width: 256, height: 256 });
	});

	const avatarSrc = await rats.locator('#team-standings img').first().getAttribute('src');

	await test.step('the scoreboard shows the picture, an initial for the other team, and the image', async () => {
		const scoreboard = await open(browser, null, { width: 1280, height: 800 });
		await scoreboard.goto(scoreboardUrl);
		const rows = scoreboard.getByRole('list', { name: 'Scoreboard' }).getByRole('listitem');
		await expect(rows.filter({ hasText: 'Canal Rats' }).locator('img')).toHaveAttribute(
			'src',
			avatarSrc!
		);
		await expect(rows.filter({ hasText: 'Night Owls' }).locator('img')).toHaveCount(0);
		await expect(rows.filter({ hasText: 'Night Owls' })).toContainText('N');
		await expect(
			scoreboard.getByRole('button', { name: 'View Birthday invitation' })
		).toBeVisible();
	});

	await test.step('the admin removes the team picture and its file goes', async () => {
		await admin.reload();
		await expect(async () => {
			await admin.getByRole('button', { name: 'Edit Canal Rats' }).click();
			await expect(admin.getByRole('button', { name: 'Remove picture' })).toBeVisible({
				timeout: 1000
			});
		}).toPass();
		admin.once('dialog', (dialog) => dialog.accept());
		await admin.getByRole('button', { name: 'Remove picture' }).click();
		await expect(admin.getByRole('button', { name: 'Remove picture' })).toBeHidden();
		expect((await admin.request.get(avatarSrc!)).status()).toBe(404);
	});

	await test.step('resetting the game deletes the game image', async () => {
		admin.once('dialog', (dialog) => dialog.accept());
		await admin.getByRole('button', { name: 'Reset game' }).click();
		await expect(admin.getByRole('img', { name: 'Birthday invitation' })).toBeHidden();
		expect((await admin.request.get(gameImageSrc!)).status()).toBe(404);
	});
});

async function open(
	browser: Browser,
	nickname: string | null,
	viewport?: { width: number; height: number }
): Promise<Page> {
	const context = await browser.newContext(viewport ? { viewport, hasTouch: false } : {});
	if (nickname) {
		await context.addInitScript((name) => {
			localStorage.setItem('huntboard.nickname', name);
		}, nickname);
	}
	const page = await context.newPage();
	watchCsp(page);
	return page;
}

/** A PNG drawn in the page, so the test needs no fixture files. */
async function png(page: Page, width: number, height: number) {
	const base64 = await page.evaluate(
		([w, h]) => {
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const context = canvas.getContext('2d')!;
			context.fillStyle = '#f25c05';
			context.fillRect(0, 0, w, h);
			context.fillStyle = '#14213d';
			context.fillRect(0, 0, w / 2, h / 2);
			return canvas.toDataURL('image/png').split(',')[1];
		},
		[width, height]
	);
	return { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

async function pick(
	page: Page,
	button: string,
	file: { name: string; mimeType: string; buffer: Buffer }
) {
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: button }).click();
	await (await chooser).setFiles(file);
}

async function naturalSize(image: ReturnType<Page['locator']>) {
	await expect
		.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
		.toBe(true);
	return image.evaluate((img: HTMLImageElement) => ({
		width: img.naturalWidth,
		height: img.naturalHeight
	}));
}
