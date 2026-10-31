import { describe, expect, it } from 'vitest';
import { formatJoinCode, joinCodeOf, normalizeJoinCode, tokenPrefixOf } from './join-code.js';
import { encodeBase64Url, generateToken } from './token.js';

const tokenOf = (...bytes: number[]) =>
	encodeBase64Url(new Uint8Array([...bytes, ...new Array(16 - bytes.length).fill(0)]));

describe('joinCodeOf', () => {
	it('spells the first 40 bits of the token in Crockford base32', () => {
		// 00001 00010 00011 00100 00101 00110 00111 01000
		expect(joinCodeOf(tokenOf(0x08, 0x86, 0x42, 0x98, 0xe8))).toBe('12345678');
	});

	it('ignores the bits after the first 40', () => {
		expect(joinCodeOf(tokenOf(0, 0, 0, 0, 0, 0xff, 0xff))).toBe('00000000');
		expect(joinCodeOf(tokenOf(0xff, 0xff, 0xff, 0xff, 0xff))).toBe('ZZZZZZZZ');
	});

	it('uses no I, L, O or U', () => {
		const codes = Array.from({ length: 2_000 }, () => joinCodeOf(generateToken())).join('');
		expect(codes).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
		expect(new Set(codes).size).toBe(32);
	});
});

describe('tokenPrefixOf', () => {
	it('gives the start of every token with that code', () => {
		for (const token of Array.from({ length: 1_000 }, generateToken)) {
			expect(token.startsWith(tokenPrefixOf(joinCodeOf(token)))).toBe(true);
		}
	});
});

describe('formatJoinCode', () => {
	it('splits the code into two groups of four', () => {
		expect(formatJoinCode('K7Q4M2XD')).toBe('K7Q4-M2XD');
	});
});

describe('normalizeJoinCode', () => {
	it('takes a code as shown', () => {
		expect(normalizeJoinCode('K7Q4-M2XD')).toBe('K7Q4M2XD');
	});

	it('ignores case, spaces and dashes', () => {
		expect(normalizeJoinCode('  k7q4 m2xd ')).toBe('K7Q4M2XD');
		expect(normalizeJoinCode('k7-q4-m2-xd')).toBe('K7Q4M2XD');
		expect(normalizeJoinCode('K7Q4–M2XD')).toBe('K7Q4M2XD');
	});

	it('reads letters that look like digits as those digits', () => {
		expect(normalizeJoinCode('OoIi-LlAB')).toBe('001111AB');
	});

	it('refuses other lengths and characters', () => {
		expect(normalizeJoinCode('')).toBeNull();
		expect(normalizeJoinCode('K7Q4-M2X')).toBeNull();
		expect(normalizeJoinCode('K7Q4-M2XDA')).toBeNull();
		expect(normalizeJoinCode('K7Q4-M2XU')).toBeNull();
		expect(normalizeJoinCode('K7Q4-M2X!')).toBeNull();
	});
});
