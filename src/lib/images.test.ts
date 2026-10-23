import { describe, expect, it } from 'vitest';
import { imageSrc, initialOf } from './images.js';

describe('imageSrc', () => {
	it('serves a key from the images route', () => {
		expect(imageSrc('12/abcdefghijklmnopqrstuv.webp')).toBe(
			'/images/12/abcdefghijklmnopqrstuv.webp'
		);
	});
});

describe('initialOf', () => {
	it('takes the first letter, upper case', () => {
		expect(initialOf('canal Rats')).toBe('C');
	});

	it('keeps a letter with a combining accent whole', () => {
		expect(initialOf('éclair')).toBe('É');
	});

	it('is empty for an empty name', () => {
		expect(initialOf('')).toBe('');
	});
});
