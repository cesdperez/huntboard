import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { POLL_INTERVAL_MS } from '../src/lib/live-updates.js';

// A short game played end to end: 4 teams, 10 challenges, every kind of judging, a late arrival
// and a tie. The final totals are worked out by hand in FINAL_STANDINGS.

const CREATE_GAME_CODE = process.env.CREATE_GAME_CODE ?? 'letmein';
const PENALTY_PER_MINUTE = 2;
// The scoreboard has no actions of its own, so it changes only on its next poll.
const SCOREBOARD_POLL_TIMEOUT = POLL_INTERVAL_MS + 10_000;
const TEAMS = ['Canal Rats', 'Night Owls', 'Bike Thieves', 'Tulip Squad'] as const;
type TeamName = (typeof TEAMS)[number];

const CHALLENGES = `# Around town

- Make a birthday card [5-20]
  Judged on effort. A napkin counts, but barely.
- Deliver a free Marktplaats item by bike [30-100]
- Swim in a fountain [25]
- Photo with a street musician [10-15]

# Food

- Get a free dessert from a restaurant [10-15]
- Eat something you have never tried [5-10]
- Order a drink in Dutch [5]

# Team

- Build a human pyramid [10-30]
- Sing on a bridge [15]
- Find a canal cat [20]
`;

const FINAL_STANDINGS = [
	// 77 typed + 20 (middle of 10-30) - 3 penalty
	['1st', 'Night Owls', '94'],
	// 20 + 25 + 15 on the second try
	['2nd', 'Canal Rats', '60'],
	// 5 + 27 bonus
	['3rd', 'Bike Thieves', '32'],
	// 15 + 5 + 20 from the grid - 4 minutes late × 2
	['3rd', 'Tulip Squad', '32']
];

const cspViolations: string[] = [];

test.afterEach(() => {
	expect(cspViolations).toEqual([]);
});

test('rehearsal: a 4-team, 10-challenge game from creation to final scores', async ({
	browser
}) => {
	const admin = await openAs(browser, 'Rehearsal judge');

	await test.step('create the game', async () => {
		await admin.goto('/new');
		await admin.getByLabel('Game name').fill(`Rehearsal ${new Date().toISOString().slice(11, 19)}`);
		await admin.getByLabel('Creation code').fill(CREATE_GAME_CODE);
		await admin.getByRole('button', { name: 'Create game' }).click();
		await expect(admin).toHaveURL(/\/a\/[^/]+\/setup$/);
	});

	await test.step('set the game window to running, with a late penalty', async () => {
		const [start, end] = await localInputs(admin, [-30, 60]);
		await admin.getByLabel('Start').fill(start);
		await admin.getByLabel('End').fill(end);
		await admin.getByLabel('Late penalty per minute').fill(String(PENALTY_PER_MINUTE));
		await admin.getByRole('button', { name: 'Save game' }).click();
		await expect(admin.getByText('Saved.')).toBeVisible();
	});

	await test.step('add 4 teams', async () => {
		for (const name of TEAMS) {
			await admin.getByLabel('New team').fill(name);
			await admin.getByRole('button', { name: 'Add team' }).click();
			await expect(admin.getByRole('list', { name: /^Teams in/ })).toContainText(name);
		}
	});

	await test.step('import 10 challenges', async () => {
		await admin.getByLabel('Paste your list').fill(CHALLENGES);
		await admin.getByRole('button', { name: 'Preview' }).click();
		await admin.getByRole('button', { name: 'Import 10 challenges' }).click();
		await expect(admin.getByText('Imported 10 challenges.')).toBeVisible();
	});

	const scoreboardUrl = await admin.getByLabel('Scoreboard', { exact: true }).inputValue();
	const teamUrls = new Map<TeamName, string>();
	for (const name of TEAMS) {
		teamUrls.set(name, await admin.getByLabel(name, { exact: true }).inputValue());
	}

	const scoreboard = await openAs(browser, null, { width: 1920, height: 1080 });
	await test.step('the scoreboard lists every team at 0 points', async () => {
		await scoreboard.goto(scoreboardUrl);
		await expect(standings(scoreboard)).toHaveText(TEAMS.map((name) => rowText('1st', name, '0')));
		await expect(scoreboard.getByText(/^Ends in \d+:\d\d:\d\d$/)).toBeVisible();
	});

	const teams = new Map<TeamName, Page>();
	for (const name of TEAMS) {
		const page = await openAs(browser, `${name} player`);
		await page.goto(teamUrls.get(name)!);
		await expect(page.getByRole('banner')).toContainText(name);
		teams.set(name, page);
	}
	const team = (name: TeamName) => teams.get(name)!;

	await test.step('teams mark challenges done, and one undoes a claim', async () => {
		await markDone(team('Canal Rats'), 'Make a birthday card', 'card in the group chat');
		await markDone(team('Canal Rats'), 'Swim in a fountain');
		await markDone(team('Canal Rats'), 'Get a free dessert from a restaurant');
		await markDone(team('Night Owls'), 'Deliver a free Marktplaats item by bike', 'a whole sofa');
		await markDone(team('Night Owls'), 'Build a human pyramid');
		await markDone(team('Bike Thieves'), 'Order a drink in Dutch');
		await markDone(team('Bike Thieves'), 'Find a canal cat');
		await markDone(team('Tulip Squad'), 'Sing on a bridge');
		await markDone(team('Tulip Squad'), 'Eat something you have never tried');

		const thieves = team('Bike Thieves');
		await openChallenge(thieves, 'Find a canal cat');
		await thieves.getByRole('button', { name: 'Undo claim' }).click();
		await expect(toast(thieves)).toHaveText('Claim undone');
	});

	await test.step('a team never sees another team claims', async () => {
		const owls = team('Night Owls');
		await expect(owls.getByRole('button', { name: /Make a birthday card/ })).toHaveAccessibleName(
			/^Open\b/
		);
		await expect(owls.getByText('card in the group chat')).toHaveCount(0);
	});

	await test.step('the admin judges the queue oldest first', async () => {
		await admin.getByRole('link', { name: /^Queue/ }).click();
		await expect(admin.getByRole('heading', { name: 'Queue' })).toBeVisible();
		await expect(queueItems(admin)).toHaveCount(8);
		await expect(queueItems(admin).first()).toHaveAccessibleName(
			'Canal Rats, Make a birthday card'
		);

		await scoreQuick(admin, 'Canal Rats', 'Make a birthday card', 20);
		await scoreQuick(admin, 'Canal Rats', 'Swim in a fountain', 25);
		await reject(admin, 'Canal Rats', 'Get a free dessert from a restaurant', 'No proof received');
		await scoreTyped(admin, 'Night Owls', 'Deliver a free Marktplaats item by bike', 77);
		await scoreQuick(admin, 'Night Owls', 'Build a human pyramid', 20);
		await scoreQuick(admin, 'Bike Thieves', 'Order a drink in Dutch', 5);
		await scoreQuick(admin, 'Tulip Squad', 'Sing on a bridge', 15);
		await scoreQuick(admin, 'Tulip Squad', 'Eat something you have never tried', 5);
		await expect(admin.getByText('Nothing to judge. New claims show up here.')).toBeVisible();
	});

	await test.step('the scoreboard reorders while judging goes on', async () => {
		await expect(standings(scoreboard)).toHaveText(
			[
				rowText('1st', 'Night Owls', '97'),
				rowText('2nd', 'Canal Rats', '45'),
				rowText('3rd', 'Tulip Squad', '20'),
				rowText('4th', 'Bike Thieves', '5')
			],
			{ timeout: SCOREBOARD_POLL_TIMEOUT }
		);
	});

	await test.step('a rejected team sees the reason and claims again', async () => {
		const rats = team('Canal Rats');
		await rats.reload();
		const dessert = rats.getByRole('button', { name: /Get a free dessert/ });
		await expect(dessert).toContainText('Rejected: No proof received');
		await markDone(rats, 'Get a free dessert from a restaurant', 'receipt photo');

		await admin.reload();
		// The countdown shows only once the page hydrates. A tap before that posts the form without
		// the nickname, and the server refuses it.
		await expect(admin.getByText(/^Ends in /)).toBeVisible();
		await scoreQuick(admin, 'Canal Rats', 'Get a free dessert from a restaurant', 15);
	});

	await test.step('the admin scores proof that came in person from the grid', async () => {
		await admin.getByRole('link', { name: 'Grid' }).click();
		await admin.getByRole('button', { name: 'Tulip Squad, Find a canal cat: Open' }).click();
		const sheet = admin.getByRole('dialog');
		await sheet.getByRole('button', { name: 'Score 20 for Tulip Squad, Find a canal cat' }).click();
		await expect(toast(admin)).toHaveText('Scored 20');
		await expect(
			admin.getByRole('button', { name: 'Tulip Squad, Find a canal cat: Scored 20 points' })
		).toBeVisible();
	});

	await test.step('the admin adds a bonus and a penalty', async () => {
		await admin.getByRole('link', { name: 'Teams' }).click();
		await addAdjustment(admin, 'Bike Thieves', 'bonus', 27, 'Best costume');
		await addAdjustment(admin, 'Night Owls', 'penalty', 3, 'Skipped a red light');
	});

	await test.step('three teams arrive on time', async () => {
		for (const name of ['Canal Rats', 'Night Owls', 'Bike Thieves'] as const) {
			const item = teamItem(admin, name);
			await item.getByRole('button', { name: 'Record arrival' }).click();
			await expect(item.getByRole('button', { name: 'Correct' })).toBeVisible();
		}
	});

	// The end moves to the current minute, so the arrivals just recorded are less than a minute late.
	const [end, lateArrival] = await localInputs(admin, [0, 4]);

	await test.step('the game ends', async () => {
		await admin.getByRole('link', { name: 'Setup' }).click();
		await admin.getByLabel('End').fill(end);
		await admin.getByRole('button', { name: 'Save game' }).click();
		await expect(admin.getByText('Saved.')).toBeVisible();
	});

	await test.step('the last team arrives 4 minutes late', async () => {
		await admin.getByRole('link', { name: 'Teams' }).click();
		const tulips = teamItem(admin, 'Tulip Squad');
		await tulips.getByRole('button', { name: 'Enter time' }).click();
		await tulips.getByLabel('Arrival time').fill(lateArrival);
		await tulips.getByRole('button', { name: 'Save time' }).click();
		await expect(tulips).toContainText(`4 min × ${PENALTY_PER_MINUTE}`);
		for (const name of ['Canal Rats', 'Night Owls', 'Bike Thieves'] as const) {
			await expect(teamItem(admin, name).getByText(/^Late penalty/)).toHaveText('Late penalty');
		}
	});

	await test.step('teams can no longer mark challenges done', async () => {
		const owls = team('Night Owls');
		await owls.reload();
		await expect(owls.getByText(/^Ended at /)).toBeVisible();
		await openChallenge(owls, 'Photo with a street musician');
		await expect(owls.getByRole('button', { name: 'Mark done' })).toBeDisabled();
		await expect(owls.getByRole('dialog')).toContainText('Claims are closed.');
	});

	await test.step('the scoreboard shows the final ranking, with a tie', async () => {
		await expect(standings(scoreboard)).toHaveText(
			FINAL_STANDINGS.map(([rank, name, total]) => rowText(rank, name, total)),
			{ timeout: SCOREBOARD_POLL_TIMEOUT }
		);
		await expect(scoreboard.getByText(/^Ended at /)).toBeVisible();
	});

	await test.step('each team strip shows its own rank and total', async () => {
		for (const [rank, name, total] of FINAL_STANDINGS) {
			const page = team(name as TeamName);
			await page.reload();
			await expect(page.getByRole('banner').getByRole('button').first()).toContainText(
				new RegExp(`${rank}\\s*${name}\\s*${total}`)
			);
		}
	});
});

async function openAs(
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
	page.on('console', (message) => {
		if (message.text().includes('Content Security Policy')) cspViolations.push(message.text());
	});
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

function standings(page: Page): Locator {
	return page.getByRole('list', { name: 'Scoreboard' }).getByRole('listitem');
}

function rowText(rank: string, name: string, total: string): RegExp {
	return new RegExp(`^\\s*${rank}\\s*${name}\\s*${total}`);
}

function toast(page: Page): Locator {
	return page.getByRole('status').filter({ hasText: /\S/ }).last();
}

async function openChallenge(page: Page, title: string) {
	// A tap before the page hydrates does nothing, so tap again until the sheet opens.
	await expect(async () => {
		await page.getByRole('button', { name: new RegExp(title) }).click();
		await expect(page.getByRole('dialog')).toContainText(title, { timeout: 1000 });
	}).toPass();
}

async function markDone(page: Page, title: string, note?: string) {
	await openChallenge(page, title);
	if (note) await page.getByLabel('Note').fill(note);
	await page.getByRole('button', { name: 'Mark done' }).click();
	await expect(toast(page)).toHaveText('Marked done');
	await expect(page.getByRole('button', { name: new RegExp(title) })).toContainText(
		'Waiting for a judge'
	);
}

function queueItems(page: Page): Locator {
	return page.getByRole('list', { name: 'Claims to judge, oldest first' }).getByRole('listitem');
}

function queueItem(page: Page, team: string, challenge: string): Locator {
	return page.getByRole('listitem', { name: `${team}, ${challenge}`, exact: true });
}

async function scoreQuick(page: Page, team: string, challenge: string, points: number) {
	const item = queueItem(page, team, challenge);
	await item.getByRole('button', { name: `Score ${points} for ${team}, ${challenge}` }).click();
	await expect(toast(page)).toHaveText(`Scored ${points}`);
	await expect(item).toHaveCount(0);
}

async function scoreTyped(page: Page, team: string, challenge: string, points: number) {
	const item = queueItem(page, team, challenge);
	await item.getByLabel(`Other points for ${team}, ${challenge}`).fill(String(points));
	await item.getByRole('button', { name: `Score ${team}, ${challenge}`, exact: true }).click();
	await expect(toast(page)).toHaveText(`Scored ${points}`);
	await expect(item).toHaveCount(0);
}

async function reject(page: Page, team: string, challenge: string, reason: string) {
	const item = queueItem(page, team, challenge);
	await item.getByRole('button', { name: `Reject ${team}, ${challenge}`, exact: true }).click();
	await item.getByLabel(/^Reason/).fill(reason);
	await item.getByRole('button', { name: 'Reject claim' }).click();
	await expect(toast(page)).toHaveText('Rejected');
	await expect(item).toHaveCount(0);
}

function teamItem(page: Page, team: string): Locator {
	return page.getByRole('listitem', { name: team, exact: true });
}

async function addAdjustment(
	page: Page,
	team: string,
	sign: 'bonus' | 'penalty',
	points: number,
	reason: string
) {
	const item = teamItem(page, team);
	await item.getByRole('button', { name: 'Add adjustment' }).click();
	await item.getByLabel(sign === 'bonus' ? 'Bonus' : 'Penalty').check();
	await item.getByLabel('Points').fill(String(points));
	await item.getByLabel('Reason').fill(reason);
	await item.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(toast(page)).toHaveText('Adjustment added');
}
