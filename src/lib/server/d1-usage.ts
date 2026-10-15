import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';

interface D1Usage {
	/** Round trips to D1. A batch is one call however many statements it holds. */
	calls: number;
	queries: number;
	rowsRead: number;
	rowsWritten: number;
}

const requestUsage = new AsyncLocalStorage<D1Usage>();
let instrumented = false;

function record(metas: (D1Meta | undefined)[]) {
	const usage = requestUsage.getStore();
	if (!usage) return;
	usage.calls += 1;
	for (const meta of metas) {
		if (!meta) continue;
		usage.queries += 1;
		usage.rowsRead += meta.rows_read;
		usage.rowsWritten += meta.rows_written;
	}
}

/** Wraps the D1 prototypes, so every query of a request adds its meta to that request's usage. */
function instrument(db: D1Database) {
	const statement = Object.getPrototypeOf(db.prepare('SELECT 1')) as D1PreparedStatement;
	const database = Object.getPrototypeOf(db) as D1Database;
	const { all, run } = statement;
	const { batch } = database;

	statement.all = async function (this: D1PreparedStatement) {
		const result = await all.call(this);
		record([result.meta]);
		return result;
	} as typeof all;
	statement.run = async function (this: D1PreparedStatement) {
		const result = await run.call(this);
		record([result.meta]);
		return result;
	} as typeof run;
	// first() hides meta. D1 runs the whole query for first() too, so all() reads the same rows.
	statement.first = async function (this: D1PreparedStatement, column?: string) {
		const [row] = (await this.all<Record<string, unknown>>()).results;
		if (!row) return null;
		return column === undefined ? row : row[column];
	} as typeof statement.first;
	database.batch = async function (this: D1Database, statements: D1PreparedStatement[]) {
		const results = await batch.call(this, statements);
		record(results.map((result) => result.meta));
		return results;
	} as typeof batch;
}

/**
 * Adds a Server-Timing header with the D1 queries and rows of each request, for the load test.
 * Only runs when LOADTEST_METRICS is set, because it replaces D1 methods for the whole isolate.
 */
export const measureD1Usage: Handle = async ({ event, resolve }) => {
	if (!instrumented) {
		instrument(env.DB);
		instrumented = true;
	}
	const usage: D1Usage = { calls: 0, queries: 0, rowsRead: 0, rowsWritten: 0 };
	const response = await requestUsage.run(usage, () => resolve(event));
	response.headers.set(
		'server-timing',
		`d1;desc="calls=${usage.calls} queries=${usage.queries} rows_read=${usage.rowsRead} rows_written=${usage.rowsWritten}"`
	);
	return response;
};
