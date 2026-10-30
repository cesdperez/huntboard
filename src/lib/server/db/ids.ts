/** Tables whose ids pages post back, so an id is never given to a second row. See migrations/0010_id_high.sql. */
export type FreshIdTable = 'team' | 'challenge' | 'claim' | 'adjustment';

/**
 * SQL for the id of a row inserted into `table`: one above any id the table ever had. A trigger
 * refuses an insert without it. Use it in a statement that inserts one row.
 */
export function nextId(table: FreshIdTable): string {
	return `(SELECT high + 1 FROM id_high WHERE name = '${table}')`;
}
