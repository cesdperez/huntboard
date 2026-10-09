import { describe, expect, it } from 'vitest';
import { GAME_NAME_MAX_LENGTH } from '#lib/game-settings.js';
import { gameNameError, parseGameSettings } from './game-settings-form.js';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	const defaults = {
		name: 'Canal hunt',
		starts_at: '2026-06-20T14:00:00.000Z',
		ends_at: '2026-06-20T19:00:00.000Z',
		late_penalty_per_minute: '5'
	};
	for (const [key, value] of Object.entries({ ...defaults, ...fields })) data.set(key, value);
	return data;
}

describe('parseGameSettings', () => {
	it('reads valid settings', () => {
		expect(parseGameSettings(form({ name: '  Canal hunt  ' }))).toEqual({
			ok: true,
			settings: {
				name: 'Canal hunt',
				starts_at: '2026-06-20T14:00:00.000Z',
				ends_at: '2026-06-20T19:00:00.000Z',
				late_penalty_per_minute: 5
			}
		});
	});

	it('reads empty times as not set', () => {
		const result = parseGameSettings(form({ starts_at: '', ends_at: '' }));

		expect(result).toMatchObject({ ok: true, settings: { starts_at: null, ends_at: null } });
	});

	it('requires a name', () => {
		expect(parseGameSettings(form({ name: ' ' }))).toEqual({
			ok: false,
			errors: { name: 'Give the game a name.' }
		});
	});

	it('rejects a name over the maximum length', () => {
		expect(parseGameSettings(form({ name: 'x'.repeat(101) }))).toMatchObject({
			ok: false,
			errors: { name: expect.any(String) }
		});
	});

	it.each(['2026-06-20T16:00', '2026-06-20T14:00:00Z', '2026-02-30T14:00:00.000Z', 'soon'])(
		'rejects %s as a time that is not UTC ISO',
		(value) => {
			expect(parseGameSettings(form({ starts_at: value, ends_at: value }))).toEqual({
				ok: false,
				errors: { starts_at: 'Enter a valid start time.', ends_at: 'Enter a valid end time.' }
			});
		}
	);

	it.each([
		['before', '2026-06-20T13:00:00.000Z'],
		['equal to', '2026-06-20T14:00:00.000Z']
	])('rejects an end %s the start', (_, endsAt) => {
		expect(parseGameSettings(form({ ends_at: endsAt }))).toEqual({
			ok: false,
			errors: { ends_at: 'End the game after it starts.' }
		});
	});

	it('accepts a start without an end', () => {
		expect(parseGameSettings(form({ ends_at: '' }))).toMatchObject({ ok: true });
	});

	it('accepts a penalty of 0', () => {
		expect(parseGameSettings(form({ late_penalty_per_minute: '0' }))).toMatchObject({
			ok: true,
			settings: { late_penalty_per_minute: 0 }
		});
	});

	it.each(['', '-1', '1.5', 'five', '1e3', '1000001'])('rejects a penalty of "%s"', (value) => {
		expect(parseGameSettings(form({ late_penalty_per_minute: value }))).toEqual({
			ok: false,
			errors: { late_penalty_per_minute: expect.any(String) }
		});
	});

	it('reports every invalid field at once', () => {
		const result = parseGameSettings(form({ name: '', late_penalty_per_minute: '-1' }));

		expect(result).toMatchObject({
			ok: false,
			errors: { name: expect.any(String), late_penalty_per_minute: expect.any(String) }
		});
	});
});

describe('gameNameError', () => {
	it('accepts a name up to the maximum length', () => {
		expect(gameNameError('x'.repeat(GAME_NAME_MAX_LENGTH))).toBeNull();
	});

	it('requires a name', () => {
		expect(gameNameError('')).toBe('Give the game a name.');
	});

	it('rejects a name over the maximum length', () => {
		expect(gameNameError('x'.repeat(GAME_NAME_MAX_LENGTH + 1))).toBe(
			`Keep the name to ${GAME_NAME_MAX_LENGTH} characters or fewer.`
		);
	});
});
