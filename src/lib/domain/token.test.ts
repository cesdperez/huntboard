import { describe, expect, it } from 'vitest';
import { encodeBase64Url, generateToken, isToken, sha256Base64Url } from './token.js';

describe('generateToken', () => {
	it('encodes 128 bits as 22 base64url characters without padding', () => {
		expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
	});

	it('does not repeat over many samples', () => {
		const samples = 10_000;
		const tokens = new Set(Array.from({ length: samples }, generateToken));
		expect(tokens.size).toBe(samples);
	});

	it('uses the whole base64url alphabet over many samples', () => {
		const seen = new Set(Array.from({ length: 2_000 }, generateToken).join(''));
		expect(seen.size).toBe(64);
	});
});

describe('isToken', () => {
	it('takes what generateToken makes', () => {
		expect(Array.from({ length: 1_000 }, generateToken).every(isToken)).toBe(true);
	});

	it('refuses other lengths, characters and types', () => {
		expect(isToken('q7Zt3kV9xW2mN4pL8rB6s')).toBe(false);
		expect(isToken('q7Zt3kV9xW2mN4pL8rB6sAA')).toBe(false);
		expect(isToken('q7Zt3kV9xW2mN4pL8r+6sA')).toBe(false);
		expect(isToken(null)).toBe(false);
	});

	it('refuses a last character that 128 bits cannot end in', () => {
		expect(isToken('q7Zt3kV9xW2mN4pL8rB6sB')).toBe(false);
	});
});

describe('encodeBase64Url', () => {
	it('uses - and _ where standard base64 uses + and /', () => {
		expect(encodeBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
	});

	it('drops padding', () => {
		expect(encodeBase64Url(new Uint8Array([0x66]))).toBe('Zg');
		expect(encodeBase64Url(new Uint8Array([0x66, 0x6f]))).toBe('Zm8');
	});

	it('encodes 16 bytes as 22 characters', () => {
		expect(encodeBase64Url(new Uint8Array(16).fill(0xff))).toBe('_____________________w');
		expect(encodeBase64Url(new Uint8Array(16))).toBe('AAAAAAAAAAAAAAAAAAAAAA');
	});

	it('encodes an empty input as an empty string', () => {
		expect(encodeBase64Url(new Uint8Array())).toBe('');
	});
});

describe('sha256Base64Url', () => {
	it('hashes text to the base64url SHA-256 digest', async () => {
		expect(await sha256Base64Url('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
	});
});
