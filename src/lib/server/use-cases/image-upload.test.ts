import { describe, expect, it } from 'vitest';
import { IMAGE_TOO_LARGE, NOT_AN_IMAGE, readImageUpload, sniffImageType } from './image-upload.js';

const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1);
const WEBP = Uint8Array.of(
	...new TextEncoder().encode('RIFF'),
	0x24,
	0,
	0,
	0,
	...new TextEncoder().encode('WEBPVP8 ')
);
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);

function formWith(field: string, value: string | Blob, filename = 'image') {
	const data = new FormData();
	if (typeof value === 'string') data.set(field, value);
	else data.set(field, value, filename);
	return data;
}

const file = (bytes: Uint8Array<ArrayBuffer>, type: string) => new Blob([bytes], { type });

describe('sniffImageType', () => {
	it('recognises JPEG and WebP by their first bytes', () => {
		expect(sniffImageType(JPEG)).toBe('image/jpeg');
		expect(sniffImageType(WEBP)).toBe('image/webp');
	});

	it('rejects other formats and RIFF files that are not WebP', () => {
		const wave = Uint8Array.from(WEBP);
		wave.set(new TextEncoder().encode('WAVE'), 8);

		expect(sniffImageType(PNG)).toBeNull();
		expect(sniffImageType(wave)).toBeNull();
		expect(sniffImageType(new Uint8Array())).toBeNull();
	});
});

describe('readImageUpload', () => {
	it('reads a WebP file whose bytes match its type', async () => {
		const result = await readImageUpload(
			formWith('image', file(WEBP, 'image/webp')),
			'image',
			1000
		);

		expect(result).toEqual({ status: 'ok', upload: { bytes: WEBP, contentType: 'image/webp' } });
	});

	it('reads a JPEG file', async () => {
		const result = await readImageUpload(
			formWith('image', file(JPEG, 'image/jpeg')),
			'image',
			1000
		);

		expect(result).toMatchObject({ status: 'ok', upload: { contentType: 'image/jpeg' } });
	});

	it.each([
		['no field', new FormData()],
		['a text field', formWith('image', 'poster.jpg')],
		['an empty file', formWith('image', file(new Uint8Array(), 'application/octet-stream'))]
	])('reports %s as missing', async (_, data) => {
		expect(await readImageUpload(data, 'image', 1000)).toEqual({ status: 'missing' });
	});

	it('refuses a file over the size cap without reading it', async () => {
		const big = file(
			Uint8Array.from({ length: 1001 }, (_, i) => JPEG[i] ?? 0),
			'image/jpeg'
		);

		const result = await readImageUpload(formWith('image', big), 'image', 1000);

		expect(result).toEqual({ status: 'invalid', message: IMAGE_TOO_LARGE });
	});

	it('refuses a type other than JPEG or WebP', async () => {
		const result = await readImageUpload(formWith('image', file(PNG, 'image/png')), 'image', 1000);

		expect(result).toEqual({ status: 'invalid', message: NOT_AN_IMAGE });
	});

	it('refuses bytes that do not match the declared type', async () => {
		const html = new TextEncoder().encode('<script>alert(1)</script>');

		const disguised = await readImageUpload(
			formWith('image', file(html, 'image/webp')),
			'image',
			1000
		);
		const mislabelled = await readImageUpload(
			formWith('image', file(JPEG, 'image/webp')),
			'image',
			1000
		);

		expect(disguised).toEqual({ status: 'invalid', message: NOT_AN_IMAGE });
		expect(mislabelled).toEqual({ status: 'invalid', message: NOT_AN_IMAGE });
	});
});
