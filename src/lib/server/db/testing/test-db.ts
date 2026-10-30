import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../../../migrations');

/**
 * In-memory SQLite with every migration applied, behind the subset of the D1 API the query
 * modules use: prepare, bind, first, all, run and batch. Tests only.
 */
export function createTestDb(): D1Database {
	const sqlite = new DatabaseSync(':memory:');
	// D1 enforces foreign keys; plain SQLite does not unless asked.
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const { sql } of readMigrations()) sqlite.exec(sql);
	return asD1(sqlite);
}

/** Every migration in the order Wrangler applies them. */
export function readMigrations(): { name: string; sql: string }[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((name) => name.endsWith('.sql'))
		.sort()
		.map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }));
}

/** The D1 subset over a SQLite database the caller set up. */
export function asD1(sqlite: DatabaseSync): D1Database {
	const db = {
		prepare: (sql: string) => new FakeStatement(sqlite, sql, []),
		batch: async (statements: FakeStatement[]) => {
			sqlite.exec('BEGIN');
			try {
				const results = statements.map((statement) => statement.allSync());
				sqlite.exec('COMMIT');
				return results;
			} catch (error) {
				sqlite.exec('ROLLBACK');
				throw error;
			}
		},
		exec: async (sql: string) => {
			sqlite.exec(sql);
			return { count: 0, duration: 0 };
		}
	};
	return db as unknown as D1Database;
}

class FakeStatement {
	constructor(
		private readonly sqlite: DatabaseSync,
		private readonly sql: string,
		private readonly values: SQLInputValue[]
	) {}

	bind(...values: SQLInputValue[]) {
		return new FakeStatement(this.sqlite, this.sql, values);
	}

	async first<T>(column?: string): Promise<T | null> {
		const row = this.rows()[0];
		if (!row) return null;
		return (column === undefined ? row : row[column]) as T;
	}

	async all() {
		return this.allSync();
	}

	async run() {
		return this.allSync();
	}

	allSync() {
		const statement = this.sqlite.prepare(this.sql);
		if (statement.columns().length > 0) {
			return { success: true, results: this.rows(), meta: { changes: 0, last_row_id: 0 } };
		}
		const result = statement.run(...this.values);
		return {
			success: true,
			results: [],
			meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }
		};
	}

	private rows(): Record<string, unknown>[] {
		return this.sqlite
			.prepare(this.sql)
			.all(...this.values)
			.map((row) => ({ ...row }));
	}
}
