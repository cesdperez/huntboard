import { describe, expect, it } from 'vitest';
import { readId, readString } from './form.js';

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
