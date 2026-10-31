import { expect, test, type Browser, type Page } from '@playwright/test';
import { failOnCspViolations, watchCsp } from './csp.js';
import { openNewGameSignedIn } from './sign-in.js';

// Teams can open their link before the start without seeing the challenges, unless the admin
// shows them early, and the challenges appear within seconds of the start.

const CHALLENGES = `# Water

- Swim in a fountain [25]
- Bake a cake [5-10]
`;
// The regular poll runs once a minute, so a reveal inside this proves the page reloaded at the start.
const REVEAL_TIMEOUT_MS = 15_000;

failOnCspViolations();

test('locked challenges: hidden before the start, shown early on request, revealed at the start', async ({
	browser
}) => {
	test.setTimeout(3 * 60_000);
	const admin = await openAs(browser, 'Lock judge');

	await test.step('create a game starting in two hours, with a team and two challenges', async () => {
		await openNewGameSignedIn(admin, 'Lock judge');
		await admin.getByLabel('Game name').fill(`Rehearsal locked ${Date.now()}`);
		await admin.getByRole('button', { name: 'Create game' }).click();
		await expect(admin).toHaveURL(/\/a\/[^/]+\/setup$/);
		await saveTimes(admin, 120, 180);
		await admin.getByLabel('New team').fill('Canal Rats');
		await admin.getByRole('button', { name: 'Add team' }).click();
		await expect(admin.getByRole('list', { name: /^Teams in/ })).toContainText('Canal Rats');
		await admin.getByLabel('Paste your list').fill(CHALLENGES);
		await admin.getByRole('button', { name: 'Preview' }).click();
		await admin.getByRole('button', { name: 'Import 2 challenges' }).click();
		await expect(admin.getByText('Imported 2 challenges.')).toBeVisible();
	});

	await admin.getByRole('link', { name: 'Share', exact: true }).click();
	const ratsUrl = await admin.getByLabel('Canal Rats', { exact: true }).inputValue();
	await admin.getByRole('link', { name: 'Setup', exact: true }).click();
	const rats = await openAs(browser, 'Rat player');

	await test.step('the team page is locked, with the countdown', async () => {
		await rats.goto(ratsUrl);
		await expect(rats.getByText('Challenges unlock when the game starts.')).toBeVisible();
		await expect(rats.getByText(/^Starts in \d+:\d\d:\d\d$/).first()).toBeVisible();
		await expect(
			rats.getByText('The challenges show up here when the game starts. Tap one to open it.')
		).toBeVisible();
		await expect(rats.getByText('Swim in a fountain')).toHaveCount(0);
		await expect(rats.getByText('Water')).toHaveCount(0);
	});

	await test.step('the admin shows the challenges early', async () => {
		await admin.getByLabel('Show challenges before the game starts').check();
		await saveGame(admin);
		await rats.reload();
		await expect(rats.getByRole('button', { name: /Swim in a fountain/ })).toBeVisible();
		await expect(rats.getByText('Challenges unlock when the game starts.')).toHaveCount(0);
	});

	const startsAt =
		await test.step('the admin hides them and moves the start to the next minute', async () => {
			await admin.getByLabel('Show challenges before the game starts').uncheck();
			const start = await saveTimes(admin, 'next minute', 60);
			await rats.reload();
			await expect(rats.getByText('Challenges unlock when the game starts.')).toBeVisible();
			return start;
		});

	await test.step('the challenges appear within seconds of the start', async () => {
		const untilStart = Math.max(0, startsAt - Date.now());
		await expect(rats.getByRole('button', { name: /Swim in a fountain/ })).toBeVisible({
			timeout: untilStart + REVEAL_TIMEOUT_MS
		});
		await expect(rats.getByText('Challenges unlock when the game starts.')).toHaveCount(0);
	});
});

async function openAs(browser: Browser, nickname: string): Promise<Page> {
	const context = await browser.newContext();
	await context.addInitScript((name) => {
		localStorage.setItem('huntboard.nickname', name);
	}, nickname);
	const page = await context.newPage();
	watchCsp(page);
	return page;
}

// Waits for this save's answer: "Saved." stays on the page from the previous save.
async function saveGame(page: Page) {
	const saved = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' && response.url().includes('gameSettingsSave')
	);
	await page.getByRole('button', { name: 'Save game' }).click();
	expect((await saved).ok()).toBe(true);
	await expect(page.getByText('Saved.')).toBeVisible();
}

/**
 * Saves the game window and returns the start in epoch ms. 'next minute' starts at the next whole
 * minute at least 20 seconds away, since a datetime-local field holds whole minutes.
 */
async function saveTimes(
	page: Page,
	startMinutes: number | 'next minute',
	lengthMinutes: number
): Promise<number> {
	const { start, end, startMs } = await page.evaluate(
		({ startMinutes, lengthMinutes }) => {
			const pad = (n: number) => String(n).padStart(2, '0');
			const input = (d: Date) =>
				`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
			const minute = 60_000;
			const startMs =
				startMinutes === 'next minute'
					? Math.ceil((Date.now() + 20_000) / minute) * minute
					: Math.floor((Date.now() + startMinutes * minute) / minute) * minute;
			return {
				start: input(new Date(startMs)),
				end: input(new Date(startMs + lengthMinutes * minute)),
				startMs
			};
		},
		{ startMinutes, lengthMinutes }
	);
	await page.getByLabel('Start').fill(start);
	await page.getByLabel('End').fill(end);
	await saveGame(page);
	return startMs;
}
