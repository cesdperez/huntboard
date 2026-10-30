import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { failOnCspViolations, watchCsp } from './csp.js';
import { openNewGameSignedIn } from './sign-in.js';

// Claim photos and videos from the team's phone to the judge and the zip download: compressed in
// the browser, uploaded straight to storage, shown inline to judges, and gone once deleted.

const TEAM = 'Canal Rats';
const PHOTO_CHALLENGE = 'Swim in a fountain';
const VIDEO_CHALLENGE = 'Sing on a bridge';

failOnCspViolations();

test('media: a photo and a video from claim to download and deletion', async ({ browser }) => {
	test.setTimeout(3 * 60_000);
	const admin = await open(browser, 'Media judge');

	await test.step('create a running game with one team and two challenges', async () => {
		await openNewGameSignedIn(admin, 'Media judge');
		await admin.getByLabel('Game name').fill(`Rehearsal media ${Date.now()}`);
		await admin.getByRole('button', { name: 'Create game' }).click();
		await expect(admin).toHaveURL(/\/a\/[^/]+\/setup$/);
		const [start, end] = await localInputs(admin, [-30, 60]);
		await admin.getByLabel('Start').fill(start);
		await admin.getByLabel('End').fill(end);
		await admin.getByRole('button', { name: 'Save game' }).click();
		await expect(admin.getByText('Saved.')).toBeVisible();
		await admin.getByLabel('New team').fill(TEAM);
		await admin.getByRole('button', { name: 'Add team' }).click();
		await expect(admin.getByRole('list', { name: /^Teams in/ })).toContainText(TEAM);
		await admin
			.getByLabel('Paste your list')
			.fill(`- ${PHOTO_CHALLENGE} [25]\n- ${VIDEO_CHALLENGE} [15]\n`);
		await admin.getByRole('button', { name: 'Preview' }).click();
		await admin.getByRole('button', { name: 'Import 2 challenges' }).click();
		await expect(admin.getByText('Imported 2 challenges.')).toBeVisible();
	});

	const teamUrl = await admin.getByLabel(TEAM, { exact: true }).inputValue();
	const rats = await open(browser, 'Rat player');
	await rats.goto(teamUrl);

	await test.step('a team marks one challenge done with a photo', async () => {
		await openChallenge(rats, PHOTO_CHALLENGE);
		await pick(rats, await png(rats, 1200, 900));
		await expect(rats.getByText('Photo attached')).toBeVisible();
		await rats.getByRole('button', { name: 'Remove photo' }).click();
		await pick(rats, await png(rats, 2400, 1800));
		await expect(rats.getByText('Photo attached')).toBeVisible();
		await rats.getByLabel('Note').fill('in the big fountain');
		await rats.getByRole('button', { name: 'Mark done' }).click();
		await expect(toast(rats)).toHaveText('Marked done');
		await expect(challengeButton(rats, PHOTO_CHALLENGE).locator('img')).toBeVisible();
	});

	await test.step('a team marks another done with a video, compressed when that makes it smaller', async () => {
		await openChallenge(rats, VIDEO_CHALLENGE);
		await pick(rats, await video(rats));
		await expect(rats.getByRole('button', { name: 'Waiting for the upload' })).toBeDisabled();
		await expect(rats.getByText('Video attached')).toBeVisible({ timeout: 60_000 });
		await rats.getByRole('button', { name: 'Mark done' }).click();
		await expect(toast(rats)).toHaveText('Marked done');
	});

	await test.step('the team sees what it sent in the sheet', async () => {
		await openChallenge(rats, PHOTO_CHALLENGE);
		await expect(rats.getByRole('dialog')).toContainText('Photo sent');
		await rats.getByRole('button', { name: 'Close' }).click();
	});

	await test.step('the judge sees the photo and plays the video in the queue', async () => {
		await admin.getByRole('link', { name: 'Queue' }).click();
		const photo = queueItem(admin, PHOTO_CHALLENGE).getByRole('img', {
			name: `Photo from ${TEAM}, ${PHOTO_CHALLENGE}`
		});
		await expect(photo).toBeVisible();
		await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600);
		const clip = queueItem(admin, VIDEO_CHALLENGE).locator('video');
		await expect(clip).toHaveAttribute('aria-label', `Video from ${TEAM}, ${VIDEO_CHALLENGE}`);
		await expect(clip).toHaveAttribute('preload', 'none');
		await clip.evaluate((v: HTMLVideoElement) => {
			v.muted = true;
			return v.play();
		});
		await expect
			.poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState))
			.toBeGreaterThan(0);
		await clip.evaluate((v: HTMLVideoElement) => v.pause());

		const src = await clip.getAttribute('src');
		const range = await admin.request.get(src!, { headers: { Range: 'bytes=0-99' } });
		expect(range.status()).toBe(206);
		// The browser sends the original when compressing would not make it smaller.
		expect(range.headers()['content-type']).toMatch(/^video\/(mp4|webm)$/);
		expect(range.headers()['content-range']).toMatch(/^bytes 0-99\/\d+$/);
	});

	await test.step('the judge sees the video in the grid sheet too', async () => {
		await admin.getByRole('link', { name: 'Grid' }).click();
		await admin.getByRole('button', { name: `${TEAM}, ${VIDEO_CHALLENGE}: Pending` }).click();
		const clip = admin.getByRole('dialog').locator('video');
		await expect
			.poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState))
			.toBeGreaterThan(0);
		await admin.getByRole('button', { name: 'Close' }).click();
	});

	let photoSrc: string | null = null;
	await test.step('Setup counts the media and downloads it as one zip', async () => {
		await admin.getByRole('link', { name: 'Queue' }).click();
		photoSrc = await queueItem(admin, PHOTO_CHALLENGE).getByRole('img').getAttribute('src');
		await admin.getByRole('link', { name: 'Setup' }).click();
		const section = admin.getByRole('region', { name: 'Claim media' });
		await expect(section).toContainText('2 claims have a photo or video.');
		await expect(section.getByRole('button', { name: 'Delete all media' })).toBeHidden();

		const download = admin.waitForEvent('download');
		await section.getByRole('link', { name: 'Download all media' }).click();
		const file = await download;
		expect(file.suggestedFilename()).toMatch(/^Rehearsal media \d+-media\.zip$/);
		const zip = await streamBytes(await file.createReadStream());
		expect(zipEntryNames(zip)).toEqual([
			expect.stringMatching(new RegExp(`^${TEAM}/${PHOTO_CHALLENGE}-\\d+\\.webp$`)),
			expect.stringMatching(new RegExp(`^${TEAM}/${VIDEO_CHALLENGE}-\\d+\\.(mp4|webm)$`))
		]);
	});

	await test.step('Delete all media clears the bucket and the count', async () => {
		const section = admin.getByRole('region', { name: 'Claim media' });
		admin.once('dialog', (dialog) => dialog.accept());
		await section.getByRole('button', { name: 'Delete all media' }).click();
		await expect(toast(admin)).toHaveText('Media deleted');
		await expect(section).toContainText('No claim has a photo or video.');
		expect((await admin.request.get(photoSrc!)).status()).toBe(404);
	});
});

async function open(browser: Browser, nickname: string): Promise<Page> {
	const context = await browser.newContext();
	await context.addInitScript((name) => {
		localStorage.setItem('huntboard.nickname', name);
	}, nickname);
	const page = await context.newPage();
	watchCsp(page);
	return page;
}

/** Wall-clock times in the browser's time zone, as a datetime-local field takes them. */
function localInputs(page: Page, minutesFromNow: number[]): Promise<string[]> {
	return page.evaluate((offsets) => {
		const pad = (n: number) => String(n).padStart(2, '0');
		const base = Date.now();
		return offsets.map((minutes) => {
			const d = new Date(base + minutes * 60_000);
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
		});
	}, minutesFromNow);
}

function toast(page: Page): Locator {
	return page.getByRole('status').filter({ hasText: /\S/ }).last();
}

function challengeButton(page: Page, title: string): Locator {
	return page.getByRole('button', { name: new RegExp(title) });
}

function queueItem(page: Page, challenge: string): Locator {
	return page.getByRole('listitem', { name: `${TEAM}, ${challenge}`, exact: true });
}

async function openChallenge(page: Page, title: string) {
	// A tap before the page hydrates does nothing, so tap again until the sheet opens.
	await expect(async () => {
		await challengeButton(page, title).click();
		await expect(page.getByRole('dialog')).toContainText(title, { timeout: 1000 });
	}).toPass();
}

async function pick(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Add photo or video' }).click();
	await (await chooser).setFiles(file);
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

/** A one-second WebM recorded from a canvas in the page, so the test needs no fixture files. */
async function video(page: Page) {
	const base64 = await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 320;
		canvas.height = 240;
		const context = canvas.getContext('2d')!;
		const recorder = new MediaRecorder(canvas.captureStream(15), {
			mimeType: 'video/webm;codecs=vp8'
		});
		const chunks: Blob[] = [];
		recorder.ondataavailable = (event) => chunks.push(event.data);
		const stopped = new Promise((resolve) => (recorder.onstop = resolve));
		recorder.start();
		const started = performance.now();
		while (performance.now() - started < 1000) {
			context.fillStyle = `hsl(${(performance.now() - started) / 3} 80% 50%)`;
			context.fillRect(0, 0, 320, 240);
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		recorder.stop();
		await stopped;
		const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
		return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
	});
	return { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(base64, 'base64') };
}

async function streamBytes(stream: NodeJS.ReadableStream): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
	return Buffer.concat(chunks);
}

/** The file names in a zip's central directory. */
function zipEntryNames(zip: Buffer): string[] {
	const names: string[] = [];
	for (let at = zip.indexOf('PK\x01\x02'); at >= 0; at = zip.indexOf('PK\x01\x02', at + 46)) {
		const length = zip.readUInt16LE(at + 28);
		names.push(zip.subarray(at + 46, at + 46 + length).toString('utf8'));
	}
	return names;
}
