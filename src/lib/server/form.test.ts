import { describe, expect, it } from 'vitest';
import { readNickname, readString } from './form.js';

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

describe('readNickname', () => {
	it('reads the hidden nickname field', () => {
		expect(readNickname(formData({ nickname: ' Sam ' }))).toBe('Sam');
	});

	it('returns null when the browser sent no nickname', () => {
		expect(readNickname(formData({ nickname: '' }))).toBeNull();
		expect(readNickname(formData({}))).toBeNull();
	});
});
