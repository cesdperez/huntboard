import { describe, expect, it } from 'vitest';
import { readId, readString, readUtcTime } from './form.js';

function formData(entries: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(entries)) data.set(key, value);
	return data;
}

describe('readString', () => {
	it('trims the field', () => {
		expect(readString(formData({ name: '  Canal Rats ' }), 'name')).toBe('Canal Rats');
	});

	it('reads a missing field as empty', () => {
		expect(readString(formData({}), 'name')).toBe('');
	});
});

describe('readId', () => {
	it('reads a positive whole number', () => {
		expect(readId(formData({ teamId: ' 12 ' }), 'teamId')).toBe(12);
	});

	it.each(['', '0', '-3', '1.5', 'abc'])('reads %j as no id', (value) => {
		expect(readId(formData({ teamId: value }), 'teamId')).toBeNull();
	});

	it('reads a missing field as no id', () => {
		expect(readId(formData({}), 'teamId')).toBeNull();
	});
});

describe('readUtcTime', () => {
	it('reads a time in toISOString() format', () => {
		expect(readUtcTime(formData({ at: '2026-06-01T21:03:00.000Z' }), 'at')).toBe(
			'2026-06-01T21:03:00.000Z'
		);
	});

	it('reads an empty or missing field as null', () => {
		expect(readUtcTime(formData({ at: ' ' }), 'at')).toBeNull();
		expect(readUtcTime(formData({}), 'at')).toBeNull();
	});

	it.each(['tomorrow', '2026-06-01T21:03', '2026-06-01T21:03:00Z'])(
		'reads %j as undefined, because stored times compare as strings',
		(value) => {
			expect(readUtcTime(formData({ at: value }), 'at')).toBeUndefined();
		}
	);
});
