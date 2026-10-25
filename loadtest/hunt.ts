import { POLL_INTERVAL_MS } from '../src/lib/client/live-updates.ts';
import type { AppClient } from './http.ts';

/** The game the hunt plays, per the README "Free-tier budget". */
export const SHAPE = {
	teams: 7,
	playersPerTeam: 6,
	judges: ['Ana', 'Bo', 'Cy'],
	challenges: 50,
	hours: 5,
	/** Each player brings the page up about 12 times an hour, for about a minute each time. */
	opensPerHour: 12,
	visibleMs: 60_000,
	claimsPerTeam: 26,
	rejectShare: 0.1,
	undoShare: 0.05,
	/** Share of claims a judge takes from another judge's half of the queue, so judges collide. */
	overlapShare: 0.05,
	openCellScores: 10,
	adjustments: 14,
	latePenaltyPerMinute: 2,
	spectators: 40
} as const;

const TEAM_NAMES = [
	'Canal Rats',
	'Night Owls',
	'Bike Thieves',
	'Tulip Squad',
	'Herring Gang',
	'Stroopwafels',
	'Polder Pirates'
];

interface TeamClaim {
	id: number;
	status: 'pending' | 'scored' | 'rejected';
}

interface TeamChallenge {
	id: number;
	claim: TeamClaim | null;
}

interface PendingClaim {
	id: number;
	team_id: number;
	min_points: number;
	max_points: number;
}

interface GridRow {
	id: number;
	minPoints: number;
	maxPoints: number;
	cells: { teamId: number; claim: TeamClaim | null }[];
}

interface Standing {
	teamId: number;
	name: string;
	total: number;
}

interface Team {
	id: number;
	name: string;
	token: string;
	challenges: TeamChallenge[];
	claimsLeft: number;
}

export interface HuntResult {
	expected: Map<number, number>;
	standings: Standing[];
	/** Steps that threw, such as a refresh that got no data back. The run goes on without them. */
	failures: string[];
}

/** Plays one whole game against a fresh admin link: setup, opening rush, the hunt, and the finale. */
export async function playHunt(
	client: AppClient,
	adminToken: string,
	speed: number,
	seed: number
): Promise<HuntResult> {
	const random = mulberry32(seed);
	const admin = `/a/${adminToken}`;
	const expected = new Map<number, number>();
	const award = (teamId: number, points: number) =>
		expected.set(teamId, (expected.get(teamId) ?? 0) + points);
	const failures: string[] = [];
	const attempt = async (step: () => Promise<unknown>) => {
		try {
			await step();
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error));
		}
	};

	client.phase = 'setup';
	const { teams, scoreboard } = await setUp(client, admin);
	for (const team of teams) expected.set(team.id, 0);

	client.phase = 'opening';
	await spread(
		30_000,
		[
			...teams.flatMap((team) =>
				range(SHAPE.playersPerTeam).map(() => () => client.page('team:page', `/t/${team.token}`))
			),
			...SHAPE.judges.map(() => () => client.page('admin:page', `${admin}/queue`)),
			() => client.page('scoreboard:page', scoreboard)
		],
		random
	);

	const gameMs = SHAPE.hours * 3_600_000;
	const startedAt = Date.now();
	const endsAt = new Date(startedAt + gameMs / speed + 10_000);
	await client.action('setup:settings', `${admin}/setup`, 'gameSettingsSave', {
		name: 'Load test hunt',
		starts_at: new Date(startedAt - 60_000).toISOString(),
		ends_at: endsAt.toISOString(),
		late_penalty_per_minute: SHAPE.latePenaltyPerMinute
	});

	client.phase = 'game';
	const simNow = () => (Date.now() - startedAt) * speed;
	const sleep = (simMs: number) => wait(simMs / speed);
	const playUntil = gameMs - 2 * 60_000;

	async function refreshTeam(team: Team, kind: string) {
		const data = await client.data<{ challenges: TeamChallenge[] }>(kind, `/t/${team.token}`);
		team.challenges = data.challenges;
	}

	async function claim(team: Team, nickname: string) {
		const open = team.challenges.filter(
			(challenge) => !challenge.claim || challenge.claim.status === 'rejected'
		);
		if (open.length === 0 || team.claimsLeft <= 0) return;
		team.claimsLeft -= 1;
		const challenge = pick(open, random);
		await client.action('team:mark', `/t/${team.token}`, 'mark', {
			challengeId: challenge.id,
			nickname,
			note: 'Photo in the group chat'
		});
		await refreshTeam(team, 'team:refresh');
		const claimed = team.challenges.find((c) => c.id === challenge.id)?.claim;
		if (claimed?.status === 'pending' && random() < SHAPE.undoShare) {
			const undone = await client.action('team:undo', `/t/${team.token}`, 'undo', {
				claimId: claimed.id
			});
			if (undone.status === 200) team.claimsLeft += 1;
			await refreshTeam(team, 'team:refresh');
		}
	}

	async function player(team: Team, nickname: string) {
		const visitsPerGame = SHAPE.playersPerTeam * SHAPE.opensPerHour * SHAPE.hours;
		const claimChance = SHAPE.claimsPerTeam / visitsPerGame;
		const hiddenMs = 3_600_000 / SHAPE.opensPerHour - SHAPE.visibleMs;
		for (;;) {
			await sleep(exponential(hiddenMs, random));
			if (simNow() >= playUntil) return;
			const hideAt = simNow() + exponential(SHAPE.visibleMs, random);
			await attempt(async () => {
				await refreshTeam(team, 'team:open');
				if (random() < claimChance) await claim(team, nickname);
			});
			while (simNow() + POLL_INTERVAL_MS < hideAt) {
				await sleep(POLL_INTERVAL_MS);
				await attempt(() => refreshTeam(team, 'team:poll'));
			}
			await sleep(Math.max(0, hideAt - simNow()));
		}
	}

	async function judge(nickname: string, claim: PendingClaim, from: string) {
		if (random() < SHAPE.rejectShare) {
			await client.action('admin:reject', `${admin}/queue`, 'judgeReject', {
				claimId: claim.id,
				nickname,
				reason: 'Not in the photo',
				from
			});
			return;
		}
		const result = await client.action<{ judge: { kind: string; points?: number } }>(
			'admin:score',
			`${admin}/queue`,
			'judgeScore',
			{
				claimId: claim.id,
				nickname,
				points: between(claim.min_points, claim.max_points, random),
				from
			}
		);
		if (result.status === 200 && result.data.judge.points !== undefined) {
			award(claim.team_id, result.data.judge.points);
		}
	}

	async function judgeQueue(nickname: string, index: number, thinkMs: number) {
		const { claims } = await client.data<{ claims: PendingClaim[] }>(
			'admin:queue',
			`${admin}/queue`
		);
		const mine = claims.filter(
			(claim) => claim.id % SHAPE.judges.length === index || random() < SHAPE.overlapShare
		);
		for (const claim of mine) {
			await judge(nickname, claim, 'pending');
			await client.data('admin:refresh', `${admin}/queue`);
			await sleep(thinkMs);
		}
	}

	let openCellsLeft: number = SHAPE.openCellScores;
	async function scoreOpenCell(nickname: string) {
		const { rows } = await client.data<{ rows: GridRow[] }>('admin:grid', `${admin}/grid`);
		const open = rows.flatMap((row) =>
			row.cells.filter((cell) => !cell.claim).map((cell) => ({ row, cell }))
		);
		if (open.length === 0) return;
		openCellsLeft -= 1;
		const { row, cell } = pick(open, random);
		const result = await client.action<{ judge: { points?: number } }>(
			'admin:score-open',
			`${admin}/grid`,
			'judgeScoreOpen',
			{
				teamId: cell.teamId,
				challengeId: row.id,
				nickname,
				points: between(row.minPoints, row.maxPoints, random)
			}
		);
		if (result.status === 200 && result.data.judge.points !== undefined) {
			award(cell.teamId, result.data.judge.points);
		}
		await client.data('admin:refresh', `${admin}/grid`);
	}

	let adjustmentsLeft: number = SHAPE.adjustments;
	async function adjust(nickname: string) {
		await client.data('admin:teams', `${admin}/teams`);
		adjustmentsLeft -= 1;
		const team = pick(teams, random);
		const points = random() < 0.7 ? between(5, 15, random) : -between(3, 10, random);
		const result = await client.action('admin:adjust', `${admin}/teams`, 'adjustmentAdd', {
			teamId: team.id,
			points,
			reason: points > 0 ? 'Best costume' : 'Crossed on red',
			nickname
		});
		if (result.status === 200) award(team.id, points);
		await client.data('admin:refresh', `${admin}/teams`);
	}

	async function judgeAtWork(nickname: string, index: number) {
		const sideTabEvery = 4;
		const sideTasks = index === 1 ? SHAPE.openCellScores : SHAPE.adjustments;
		const sideTaskChance = sideTasks / (gameMs / POLL_INTERVAL_MS / sideTabEvery);
		const sideTab = index === 1 ? 'grid' : 'teams';
		for (let round = 0; simNow() < gameMs; round += 1) {
			await attempt(async () => {
				if (index === 0 || round % sideTabEvery !== 0) {
					await judgeQueue(nickname, index, 20_000);
				} else if (index === 1 && openCellsLeft > 0 && random() < sideTaskChance) {
					await scoreOpenCell(nickname);
				} else if (index === 2 && adjustmentsLeft > 0 && random() < sideTaskChance) {
					await adjust(nickname);
				} else {
					await client.data(`admin:${sideTab}`, `${admin}/${sideTab}`);
				}
			});
			await sleep(POLL_INTERVAL_MS);
		}
	}

	async function bigScreen() {
		let hoursShown = 0;
		while (simNow() < gameMs) {
			const hours = Math.floor(simNow() / 3_600_000);
			if (hours > hoursShown) {
				hoursShown = hours;
				console.log(`         game hour ${hours} of ${SHAPE.hours} played`);
			}
			await attempt(() => client.data('scoreboard:poll', scoreboard));
			await sleep(POLL_INTERVAL_MS);
		}
	}

	await Promise.all([
		...teams.flatMap((team) =>
			range(SHAPE.playersPerTeam).map((i) => player(team, `${team.name.split(' ')[0]} ${i + 1}`))
		),
		...SHAPE.judges.map((nickname, index) => judgeAtWork(nickname, index)),
		bigScreen()
	]);

	client.phase = 'finale';
	const lateTeam = pick(teams, random);
	await Promise.all([
		attempt(async () => {
			for (const team of teams) {
				const lateMs = team === lateTeam ? 3.5 * 60_000 : -between(1, 10, random) * 60_000;
				await client.action('admin:arrival', `${admin}/teams`, 'arrivalCorrect', {
					teamId: team.id,
					arrivedAt: new Date(endsAt.getTime() + lateMs).toISOString()
				});
			}
			award(lateTeam.id, -3 * SHAPE.latePenaltyPerMinute);
			await client.data('admin:refresh', `${admin}/teams`);
		}),
		...SHAPE.judges.map((nickname, index) =>
			attempt(async () => {
				await judgeQueue(nickname, index, 0);
				await judgeQueue(nickname, index, 0);
			})
		),
		spread(
			20_000,
			range(SHAPE.spectators).map(
				() => () =>
					attempt(async () => {
						await client.page('scoreboard:page', scoreboard);
						await wait(between(10_000, 40_000, random));
						await client.data('scoreboard:poll', scoreboard);
					})
			),
			random
		),
		spread(
			60_000,
			teams.flatMap((team) =>
				range(SHAPE.playersPerTeam / 2).map(
					() => () => attempt(() => refreshTeam(team, 'team:open'))
				)
			),
			random
		)
	]);

	// One judge sweeps whatever the split left behind, then everyone reads the final board.
	const { claims: leftovers } = await client.data<{ claims: PendingClaim[] }>(
		'admin:queue',
		`${admin}/queue`
	);
	for (const claim of leftovers) await judge(SHAPE.judges[0], claim, 'pending');
	const { standings } = await client.data<{ standings: Standing[] }>(
		'team:refresh',
		`/t/${teams[0].token}`
	);
	return { expected, standings, failures };
}

async function setUp(client: AppClient, admin: string) {
	for (const [index, name] of TEAM_NAMES.slice(0, SHAPE.teams).entries()) {
		await client.action('setup:team', `${admin}/setup`, 'teamsAdd', {
			name,
			members: range(SHAPE.playersPerTeam)
				.map((i) => `Player ${index * SHAPE.playersPerTeam + i + 1}`)
				.join(', ')
		});
	}
	const imported = await client.action<{ challenges: { kind: string } }>(
		'setup:import',
		`${admin}/setup`,
		'challengesImport',
		{ text: challengeList() }
	);
	if (imported.data.challenges.kind !== 'imported') {
		throw new Error(`Challenge import failed: ${JSON.stringify(imported.data)}`);
	}
	const setup = await client.data<{
		game: { scoreboard_token: string };
		teams: { id: number; name: string; token: string }[];
	}>('admin:setup', `${admin}/setup`);
	const teams: Team[] = setup.teams.map((team) => ({
		...team,
		challenges: [],
		claimsLeft: SHAPE.claimsPerTeam
	}));
	return { teams, scoreboard: `/s/${setup.game.scoreboard_token}` };
}

function challengeList(): string {
	const ranges = ['[10]', '[5-20]', '[10-30]', '[25]', '[30-100]'];
	return range(SHAPE.challenges)
		.map((i) => {
			const section = i % 10 === 0 ? `# Section ${i / 10 + 1}\n\n` : '';
			return `${section}- Challenge number ${i + 1} ${ranges[i % ranges.length]}\n  Judged on effort.`;
		})
		.join('\n');
}

/** Runs each task once, at a random moment within the window. */
async function spread(
	windowMs: number,
	tasks: (() => Promise<unknown>)[],
	random: () => number
): Promise<void> {
	await Promise.all(
		tasks.map(async (task) => {
			await wait(random() * windowMs);
			await task();
		})
	);
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function range(n: number): number[] {
	return Array.from({ length: n }, (_, i) => i);
}

function pick<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length)];
}

function between(min: number, max: number, random: () => number): number {
	return min + Math.floor(random() * (max - min + 1));
}

function exponential(mean: number, random: () => number): number {
	return -Math.log(1 - random()) * mean;
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}
