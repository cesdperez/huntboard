import type { HuntResult } from './hunt.ts';
import type { Sample } from './http.ts';

/** Cloudflare free plan, per day. See docs/decisions.md "Free-tier budget". */
const FREE_PLAN = { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 };
/** decisions.md keeps about half the rows read limit spare. */
const ROWS_READ_BUDGET = FREE_PLAN.rowsRead / 2;
/**
 * D1 queries per Worker invocation on the free plan. Cloudflare's docs do not say whether a batch
 * counts once or per statement, so the report checks calls and warns on statements.
 */
const MAX_QUERIES = 50;
const SLOW_P95_MS = 1_000;

/** Prints the run and returns the checks that failed. */
export function report(samples: Sample[], result: HuntResult): string[] {
	const failed: string[] = [];
	const check = (ok: boolean, message: string) => {
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
		if (!ok) failed.push(message);
	};

	console.log('\nPer request kind (rows read: average, at the start and end of the game, max)\n');
	const byKind = groupBy(samples, (sample) => sample.kind);
	console.table(
		[...byKind]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([kind, group]) => {
				const rows = group.map((sample) => sample.rowsRead);
				const tenth = Math.max(1, Math.floor(group.length / 10));
				return {
					kind,
					count: group.length,
					'not 200': describeStatuses(group),
					'rows avg': Math.round(average(rows)),
					'rows first 10%': Math.round(average(rows.slice(0, tenth))),
					'rows last 10%': Math.round(average(rows.slice(-tenth))),
					'rows max': Math.max(...rows),
					'calls max': Math.max(...group.map((sample) => sample.calls)),
					'statements max': Math.max(...group.map((sample) => sample.queries)),
					'p95 ms': Math.round(
						percentile(
							group.map((sample) => sample.ms),
							0.95
						)
					)
				};
			})
	);

	console.log('\nPer phase\n');
	console.table(
		[...groupBy(samples, (sample) => sample.phase)].map(([phase, group]) => ({
			phase,
			requests: group.length,
			'rows read': sum(group.map((sample) => sample.rowsRead)),
			'rows written': sum(group.map((sample) => sample.rowsWritten)),
			'p95 ms': Math.round(
				percentile(
					group.map((sample) => sample.ms),
					0.95
				)
			)
		}))
	);

	const requests = samples.length;
	const rowsRead = sum(samples.map((sample) => sample.rowsRead));
	const rowsWritten = sum(samples.map((sample) => sample.rowsWritten));
	console.log('\nOne game against the free plan\n');
	console.table([
		usageRow('Worker requests', requests, FREE_PLAN.requests),
		usageRow('D1 rows read', rowsRead, FREE_PLAN.rowsRead),
		usageRow('D1 rows written', rowsWritten, FREE_PLAN.rowsWritten)
	]);

	const unmeasured = samples.filter((sample) => sample.unmeasured).length;
	const serverErrors = samples.filter((sample) => sample.status >= 500).length;
	const maxCalls = Math.max(...samples.map((sample) => sample.calls));
	const maxStatements = Math.max(...samples.map((sample) => sample.queries));
	const slowest = [...byKind].map(([kind, group]) => ({
		kind,
		p95: percentile(
			group.map((sample) => sample.ms),
			0.95
		)
	}));
	const slow = slowest.filter(({ p95 }) => p95 > SLOW_P95_MS).map(({ kind }) => kind);
	const mismatches = scoreMismatches(result);

	console.log('');
	check(unmeasured === 0, `every request reported its D1 usage (${unmeasured} did not)`);
	check(
		rowsRead <= ROWS_READ_BUDGET,
		`rows read ${format(rowsRead)} within half the daily limit (${format(ROWS_READ_BUDGET)})`
	);
	check(
		requests <= FREE_PLAN.requests / 2,
		`requests ${format(requests)} within half the daily limit`
	);
	check(
		rowsWritten <= FREE_PLAN.rowsWritten / 2,
		`rows written ${format(rowsWritten)} within half the daily limit`
	);
	check(
		maxCalls <= MAX_QUERIES,
		`at most ${maxCalls} D1 calls in one request (limit ${MAX_QUERIES})`
	);
	check(serverErrors === 0, `no 5xx responses (${serverErrors})`);
	check(result.failures.length === 0, `no failed steps (${result.failures.length})`);
	check(
		slow.length === 0,
		`p95 latency under ${SLOW_P95_MS} ms for every kind${slow.length ? `: ${slow.join(', ')}` : ''}`
	);
	check(
		mismatches.length === 0,
		`scoreboard matches the points the judges gave${mismatches.length ? `: ${mismatches.join('; ')}` : ''}`
	);
	for (const failure of [...new Set(result.failures)].slice(0, 10)) console.log(`      ${failure}`);
	if (maxStatements > MAX_QUERIES) {
		console.log(
			`WARN  ${maxStatements} statements in one request: over ${MAX_QUERIES} if a batch counts per statement`
		);
	}
	return failed;
}

function scoreMismatches({ expected, standings }: HuntResult): string[] {
	return standings.flatMap((standing) => {
		const want = expected.get(standing.teamId);
		return want === standing.total
			? []
			: [`${standing.name} shows ${standing.total}, expected ${want}`];
	});
}

function usageRow(limit: string, used: number, allowed: number) {
	return {
		limit,
		used: format(used),
		'free plan per day': format(allowed),
		share: `${((used / allowed) * 100).toFixed(1)}%`
	};
}

function describeStatuses(group: Sample[]): string {
	const counts = new Map<number, number>();
	for (const { status } of group)
		if (status !== 200) counts.set(status, (counts.get(status) ?? 0) + 1);
	return [...counts].map(([status, count]) => `${count}x${status}`).join(' ');
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
	return groups;
}

function sum(values: number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
	return values.length ? sum(values) / values.length : 0;
}

function percentile(values: number[], share: number): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
}

function format(value: number): string {
	return value.toLocaleString('en');
}
