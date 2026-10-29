import { beforeEach, describe, expect, it } from 'vitest';
import { buildImportPreview } from '#lib/domain/challenge-import.js';
import { getImportSource, listChallenges } from '../db/challenges.js';
import { createGame } from '../db/games.js';
import { createTestDb } from '../db/testing/test-db.js';
import { seedChallenge, seedClaim, seedTeam } from '../db/testing/seed.js';
import type { GameRow } from '../db/types.js';
import {
	CHALLENGE_TEXT_MAX_LENGTH,
	editChallenge,
	importChallenges,
	previewChallengeImport
} from './challenge-setup.js';
import { MemoryBucket } from '../testing/memory-bucket.js';

const EMPTY = 'Paste at least one challenge.';
const MISSING = 'That challenge is not in this game any more. Reload the page.';

let db: D1Database;
let game: GameRow;
let media: MemoryBucket;

beforeEach(async () => {
	db = createTestDb();
	media = new MemoryBucket();
	game = await createGame(db, 'Canal hunt');
});

function form(fields: Record<string, string | string[]>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const item of [value].flat()) data.append(key, item);
	}
	return data;
}

async function previewOf(text: string) {
	const { existing, teamNames } = await getImportSource(db, game.id);
	return buildImportPreview(text, existing, teamNames);
}

async function titles() {
	return (await listChallenges(db, game.id)).map((challenge) => challenge.title);
}

describe('previewChallengeImport', () => {
	it('previews the pasted text against the stored challenges', async () => {
		const text = '- Swim in a fountain [10]\n';

		const outcome = await previewChallengeImport(db, game.id, form({ text }));

		expect(outcome).toEqual({
			status: 200,
			result: { kind: 'preview', text, preview: await previewOf(text) }
		});
	});

	it('refuses blank text', async () => {
		const outcome = await previewChallengeImport(db, game.id, form({ text: '  \n' }));

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'preview', text: '  \n', preview: null, error: EMPTY }
		});
	});

	it('refuses text over the limit', async () => {
		const text = 'x'.repeat(CHALLENGE_TEXT_MAX_LENGTH + 1);

		const outcome = await previewChallengeImport(db, game.id, form({ text }));

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'preview',
				text,
				preview: null,
				error: 'The list is too long. Keep it under 100,000 characters.'
			}
		});
	});
});

describe('importChallenges', () => {
	it('imports the pasted challenges', async () => {
		const text = '- Swim in a fountain [10]\n- Bake a cake [5-20]\n';

		const outcome = await importChallenges(db, media.asBucket(), game.id, form({ text }));

		expect(outcome).toEqual({ status: 200, result: { kind: 'imported', count: 2 } });
		expect(await titles()).toEqual(['Swim in a fountain', 'Bake a cake']);
	});

	it('refuses blank text', async () => {
		const outcome = await importChallenges(db, media.asBucket(), game.id, form({ text: '' }));

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'preview', text: '', preview: null, error: EMPTY }
		});
	});

	it('shows the preview when a line does not parse', async () => {
		const text = '- Swim in a fountain\n';

		const outcome = await importChallenges(db, media.asBucket(), game.id, form({ text }));

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'preview',
				text,
				preview: await previewOf(text),
				error: 'Fix the lines below before importing.'
			}
		});
		expect(await titles()).toEqual([]);
	});

	it('refuses text with only sections and no challenges', async () => {
		const outcome = await importChallenges(
			db,
			media.asBucket(),
			game.id,
			form({ text: '# Food\n' })
		);

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'preview', text: '# Food\n', preview: null, error: EMPTY }
		});
	});

	it('refuses to delete a claimed challenge the admin did not confirm', async () => {
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		await seedClaim(db, rats.id, swim.id);
		const text = '- Bake a cake [5]\n';

		const outcome = await importChallenges(db, media.asBucket(), game.id, form({ text }));

		expect(outcome).toEqual({
			status: 409,
			result: {
				kind: 'preview',
				text,
				preview: await previewOf(text),
				error: 'Claims came in since the preview. Check the list below and confirm again.'
			}
		});
		expect(await titles()).toEqual(['Swim in a fountain']);
	});

	it('deletes a claimed challenge the admin confirmed', async () => {
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		await seedClaim(db, rats.id, swim.id);

		const outcome = await importChallenges(
			db,
			media.asBucket(),
			game.id,
			form({ text: '- Bake a cake [5]\n', acknowledged: ['junk', `${swim.id}:1`] })
		);

		expect(outcome).toEqual({ status: 200, result: { kind: 'imported', count: 1 } });
		expect(await titles()).toEqual(['Bake a cake']);
	});

	it('deletes the media of the claims it deleted and keeps the rest', async () => {
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		const cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });
		await seedClaim(db, rats.id, swim.id, { media_key: `${game.id}/claims/swim.jpg` });
		await seedClaim(db, rats.id, cake.id, { media_key: `${game.id}/claims/cake.jpg` });
		await media.put(`${game.id}/claims/swim.jpg`, Uint8Array.of(1));
		await media.put(`${game.id}/claims/cake.jpg`, Uint8Array.of(2));

		const outcome = await importChallenges(
			db,
			media.asBucket(),
			game.id,
			form({ text: '- Bake a cake [5]\n', acknowledged: `${swim.id}:1` })
		);

		expect(outcome.status).toBe(200);
		expect(await media.head(`${game.id}/claims/swim.jpg`)).toBeNull();
		expect(await media.head(`${game.id}/claims/cake.jpg`)).not.toBeNull();
	});

	it('refuses to delete a challenge that got more claims than the admin confirmed', async () => {
		const rats = await seedTeam(db, game.id);
		const mice = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { title: 'Swim in a fountain' });
		await seedClaim(db, rats.id, swim.id);
		await seedClaim(db, mice.id, swim.id);
		const text = '- Bake a cake [5]\n';

		const outcome = await importChallenges(
			db,
			media.asBucket(),
			game.id,
			form({ text, acknowledged: `${swim.id}:1` })
		);

		expect(outcome).toEqual({
			status: 409,
			result: {
				kind: 'preview',
				text,
				preview: await previewOf(text),
				error: 'Claims came in since the preview. Check the list below and confirm again.'
			}
		});
		expect(await titles()).toEqual(['Swim in a fountain']);
	});
});

describe('editChallenge', () => {
	const values = { title: 'Swim twice', description: '', section: '', min: '5', max: '15' };

	it('edits the challenge and counts the clamped scores', async () => {
		const rats = await seedTeam(db, game.id);
		const swim = await seedChallenge(db, game.id, { min_points: 5, max_points: 20 });
		await seedClaim(db, rats.id, swim.id, { status: 'scored', points: 20 });

		const outcome = await editChallenge(db, game.id, form({ id: String(swim.id), ...values }));

		expect(outcome).toEqual({
			status: 200,
			result: { kind: 'edited', id: swim.id, clampedCount: 1 }
		});
		expect(await titles()).toEqual(['Swim twice']);
	});

	it('reports a missing id as a challenge that is gone', async () => {
		const outcome = await editChallenge(db, game.id, form({ id: 'x', ...values }));

		expect(outcome).toEqual({
			status: 400,
			result: { kind: 'edit-failed', id: 0, values, errors: { title: MISSING } }
		});
	});

	it('returns what was typed with the field errors', async () => {
		const swim = await seedChallenge(db, game.id);
		const typed = { ...values, title: '', max: '1' };

		const outcome = await editChallenge(db, game.id, form({ id: String(swim.id), ...typed }));

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'edit-failed',
				id: swim.id,
				values: typed,
				errors: { title: 'Enter a title.', max: 'Max must be at least the min (5).' }
			}
		});
	});

	it('reports a challenge from another game as gone', async () => {
		const other = await createGame(db, 'Other hunt');
		const stranger = await seedChallenge(db, other.id);

		const outcome = await editChallenge(db, game.id, form({ id: String(stranger.id), ...values }));

		expect(outcome).toEqual({
			status: 404,
			result: { kind: 'edit-failed', id: stranger.id, values, errors: { title: MISSING } }
		});
	});

	it('refuses a title another challenge has', async () => {
		await seedChallenge(db, game.id, { title: 'Swim twice' });
		const cake = await seedChallenge(db, game.id, { title: 'Bake a cake' });

		const outcome = await editChallenge(db, game.id, form({ id: String(cake.id), ...values }));

		expect(outcome).toEqual({
			status: 400,
			result: {
				kind: 'edit-failed',
				id: cake.id,
				values,
				errors: { title: 'Another challenge already has this title.' }
			}
		});
	});
});
