import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { addAdjustment } from './adjustments.js';
import { markClaim } from './claims.js';
import { addTeam } from './teams.js';
import { asD1, readMigrations } from './testing/test-db.js';

const ID_HIGH = '0010_id_high.sql';
const TABLES = ['game', 'team', 'challenge', 'claim', 'adjustment', 'media_upload'];

let sqlite: DatabaseSync;
let rowsBefore: unknown[][];

beforeEach(() => {
	sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	const migrations = readMigrations();
	for (const { name, sql } of migrations) if (name < ID_HIGH) sqlite.exec(sql);
	populate(sqlite);
	rowsBefore = rows(sqlite);
	const idHigh = migrations.find(({ name }) => name === ID_HIGH);
	if (!idHigh) throw new Error(`${ID_HIGH} is missing`);
	sqlite.exec(idHigh.sql);
});

// Two games with every kind of row, and the highest row of each table deleted, as an undo,
// a team delete, a re-import and an adjustment removal leave them.
function populate(db: DatabaseSync) {
	db.exec(`
		INSERT INTO game (id, name, admin_token, scoreboard_token) VALUES
			(1, 'Canal hunt', 'a1', 's1'), (2, 'Park hunt', 'a2', 's2');
		INSERT INTO team (id, game_id, name, name_key, token, position) VALUES
			(1, 1, 'Rats', 'rats', 't1', 0), (2, 1, 'Owls', 'owls', 't2', 1),
			(3, 2, 'Cats', 'cats', 't3', 0), (4, 1, 'Gone', 'gone', 't4', 2);
		INSERT INTO challenge (id, game_id, title, title_key, min_points, max_points, position) VALUES
			(1, 1, 'Swim', 'swim', 5, 10, 0), (2, 1, 'Cake', 'cake', 5, 10, 1),
			(3, 2, 'Kite', 'kite', 5, 10, 0), (4, 1, 'Gone', 'gone', 5, 10, 2);
		INSERT INTO claim (id, team_id, challenge_id, status, marked_by, points, media_key) VALUES
			(1, 1, 1, 'scored', 'Sam', 8, '1/claims/a.jpg'), (2, 2, 1, 'pending', 'Kim', NULL, NULL),
			(3, 1, 2, 'rejected', 'Sam', NULL, NULL), (4, 3, 3, 'pending', 'Lu', NULL, NULL),
			(5, 2, 2, 'pending', 'Kim', NULL, NULL);
		INSERT INTO adjustment (id, team_id, points, reason, created_by) VALUES
			(1, 1, -10, 'Late', 'Alex'), (2, 3, 5, 'Bonus', 'Bo'), (3, 2, 25, 'Gone', 'Alex');
		INSERT INTO media_upload (key, team_id, size) VALUES ('1/claims/a.jpg', 1, 100);
		DELETE FROM claim WHERE id = 5;
		DELETE FROM adjustment WHERE id = 3;
		DELETE FROM team WHERE id = 4;
		DELETE FROM challenge WHERE id = 4;
	`);
}

function rows(db: DatabaseSync) {
	return TABLES.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
}

describe(ID_HIGH, () => {
	it('keeps every row and every foreign key', () => {
		expect(rowsBefore.map((table) => table.length)).toEqual([2, 3, 3, 4, 2, 1]);
		expect(rows(sqlite)).toEqual(rowsBefore);
		expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
	});

	it('starts each table above its highest id', () => {
		expect(sqlite.prepare('SELECT name, high FROM id_high ORDER BY name').all()).toEqual([
			{ name: 'adjustment', high: 2 },
			{ name: 'challenge', high: 3 },
			{ name: 'claim', high: 4 },
			{ name: 'team', high: 3 }
		]);
	});

	it('gives new rows ids no row had since, even after the highest is deleted', async () => {
		// The insert functions follow the current schema, so later migrations apply first.
		for (const { name, sql } of readMigrations()) if (name > ID_HIGH) sqlite.exec(sql);
		const db = asD1(sqlite);
		const bats = await addTeam(db, 1, 'Bats', '');
		sqlite.exec('DELETE FROM team WHERE id = 4');
		const moths = await addTeam(db, 1, 'Moths', '');

		expect([bats, moths]).toMatchObject([
			{ status: 'added', team: { id: 4 } },
			{ status: 'added', team: { id: 5 } }
		]);
		expect(
			await markClaim(db, {
				gameId: 1,
				teamId: 2,
				challengeId: 2,
				note: null,
				markedBy: 'Kim',
				mediaKey: null
			})
		).toMatchObject({ status: 'marked', claim: { id: 5 } });
		expect(
			await addAdjustment(db, 1, 1, {
				points: 1,
				reason: 'Bonus',
				createdBy: 'Alex',
				requestId: null
			})
		).toMatchObject({ id: 3 });
	});

	it.each(['team', 'challenge', 'claim', 'adjustment'])(
		'refuses an insert into %s that leaves the id to SQLite',
		(table) => {
			const columns: Record<string, string> = {
				team: `(game_id, name, name_key, token, position) VALUES (1, 'New', 'new', 'tn', 9)`,
				challenge: `(game_id, title, title_key, min_points, max_points, position)
					VALUES (1, 'New', 'new', 5, 10, 9)`,
				claim: `(team_id, challenge_id, status, marked_by) VALUES (1, 2, 'pending', 'Sam')`,
				adjustment: `(team_id, points, reason, created_by) VALUES (1, 1, 'Bonus', 'Alex')`
			};

			expect(() => sqlite.exec(`INSERT INTO ${table} ${columns[table]}`)).toThrow(
				`${table} id already used`
			);
		}
	);
});
