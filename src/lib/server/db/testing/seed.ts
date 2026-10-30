import { titleKey } from '#lib/domain/challenge-parser.js';
import { teamNameKey } from '#lib/domain/team-name.js';
import { nextId, type FreshIdTable } from '../ids.js';
import type { AdjustmentRow, ChallengeRow, ClaimRow, TeamRow } from '../types.js';

/** Raw inserts for test setup, so a test does not depend on the query module it is testing. */
export async function seedTeam(
	db: D1Database,
	gameId: number,
	fields: Partial<Omit<TeamRow, 'id' | 'game_id'>> = {}
): Promise<TeamRow> {
	const position = fields.position ?? (await nextPosition(db, 'team', gameId));
	const name = fields.name ?? `Team ${position + 1}`;
	return insert<TeamRow>(db, 'team', {
		game_id: gameId,
		name,
		name_key: fields.name_key ?? teamNameKey(name),
		members: fields.members ?? '',
		token: fields.token ?? `team-token-${gameId}-${position}`,
		position,
		arrived_at: fields.arrived_at ?? null,
		avatar_key: fields.avatar_key ?? null
	});
}

export async function seedChallenge(
	db: D1Database,
	gameId: number,
	fields: Partial<Omit<ChallengeRow, 'id' | 'game_id'>> = {}
): Promise<ChallengeRow> {
	const position = fields.position ?? (await nextPosition(db, 'challenge', gameId));
	const title = fields.title ?? `Challenge ${position + 1}`;
	return insert<ChallengeRow>(db, 'challenge', {
		game_id: gameId,
		title,
		title_key: fields.title_key ?? titleKey(title),
		description: fields.description ?? null,
		section: fields.section ?? null,
		min_points: fields.min_points ?? 5,
		max_points: fields.max_points ?? 10,
		position
	});
}

export function seedClaim(
	db: D1Database,
	teamId: number,
	challengeId: number,
	fields: Partial<Omit<ClaimRow, 'id' | 'team_id' | 'challenge_id'>> = {}
): Promise<ClaimRow> {
	return insert<ClaimRow>(db, 'claim', {
		team_id: teamId,
		challenge_id: challengeId,
		status: fields.status ?? 'pending',
		note: fields.note ?? null,
		marked_by: fields.marked_by ?? 'Sam',
		...(fields.marked_at && { marked_at: fields.marked_at }),
		points: fields.points ?? null,
		judged_by: fields.judged_by ?? null,
		judged_at: fields.judged_at ?? null,
		judge_note: fields.judge_note ?? null,
		media_key: fields.media_key ?? null
	});
}

export function seedAdjustment(
	db: D1Database,
	teamId: number,
	fields: Partial<Omit<AdjustmentRow, 'id' | 'team_id'>> = {}
): Promise<AdjustmentRow> {
	return insert<AdjustmentRow>(db, 'adjustment', {
		team_id: teamId,
		points: fields.points ?? 5,
		reason: fields.reason ?? 'Bonus',
		created_by: fields.created_by ?? 'Alex'
	});
}

async function nextPosition(db: D1Database, table: 'team' | 'challenge', gameId: number) {
	const count = await db
		.prepare(`SELECT count(*) AS n FROM ${table} WHERE game_id = ?`)
		.bind(gameId)
		.first<number>('n');
	return count ?? 0;
}

async function insert<T>(
	db: D1Database,
	table: FreshIdTable,
	row: Record<string, unknown>
): Promise<T> {
	const columns = Object.keys(row);
	const inserted = await db
		.prepare(
			`INSERT INTO ${table} (id, ${columns.join(', ')})
			VALUES (${nextId(table)}, ${columns.map(() => '?').join(', ')}) RETURNING *`
		)
		.bind(...Object.values(row))
		.first<T>();
	if (!inserted) throw new Error(`Inserting into ${table} returned no row`);
	return inserted;
}
