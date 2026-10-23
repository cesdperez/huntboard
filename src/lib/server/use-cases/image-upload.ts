import type { ImageType, ImageUpload } from '../storage/image-store.js';

export type ReadImageResult =
	| { status: 'ok'; upload: ImageUpload }
	| { status: 'missing' }
	| { status: 'invalid'; message: string };

export const IMAGE_TOO_LARGE = 'This image is too large. Choose a smaller one.';
export const NOT_AN_IMAGE = 'This file is not a JPEG or WebP image. Choose another one.';

const ascii = (text: string) => new TextEncoder().encode(text);
const RIFF = ascii('RIFF');
const WEBP = ascii('WEBP');
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff);

/** The image type the bytes start with, or null for anything else. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
	if (startsWith(bytes, JPEG, 0)) return 'image/jpeg';
	if (startsWith(bytes, RIFF, 0) && startsWith(bytes, WEBP, 8)) return 'image/webp';
	return null;
}

/** An image file field, checked by size first, then by declared type and magic bytes together. */
export async function readImageUpload(
	data: FormData,
	field: string,
	maxBytes: number
): Promise<ReadImageResult> {
	const value = data.get(field);
	if (!(value instanceof File) || value.size === 0) return { status: 'missing' };
	if (value.size > maxBytes) return { status: 'invalid', message: IMAGE_TOO_LARGE };

	const bytes = new Uint8Array(await value.arrayBuffer());
	const contentType = sniffImageType(bytes);
	// The stored content type comes from the bytes, so a mislabelled file is refused, not trusted.
	if (contentType === null || contentType !== value.type) {
		return { status: 'invalid', message: NOT_AN_IMAGE };
	}
	return { status: 'ok', upload: { bytes, contentType } };
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array, offset: number): boolean {
	return (
		bytes.length >= offset + prefix.length &&
		prefix.every((byte, index) => bytes[offset + index] === byte)
	);
}
