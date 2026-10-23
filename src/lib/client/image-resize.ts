import {
	AVATAR_MAX_BYTES,
	AVATAR_SIZE,
	GAME_IMAGE_LONG_EDGE,
	GAME_IMAGE_MAX_BYTES
} from '../domain/images.js';

export interface ImageSpec {
	/** square crops the middle to size x size; fit keeps the aspect ratio within size on the long edge. */
	shape: 'square' | 'fit';
	size: number;
	maxBytes: number;
}

export const AVATAR_SPEC: ImageSpec = {
	shape: 'square',
	size: AVATAR_SIZE,
	maxBytes: AVATAR_MAX_BYTES
};

export const GAME_IMAGE_SPEC: ImageSpec = {
	shape: 'fit',
	size: GAME_IMAGE_LONG_EDGE,
	maxBytes: GAME_IMAGE_MAX_BYTES
};

export const UNREADABLE_IMAGE =
	'This file is not an image this browser can read. Choose a JPEG, PNG or WebP image.';
export const OVERSIZED_IMAGE = 'This image stays too large even when shrunk. Choose another one.';

export type ResizeResult = { ok: true; image: File } | { ok: false; message: string };

const QUALITIES = [0.85, 0.75, 0.6, 0.45];

/** Never scales up. */
export function fitWithin(
	width: number,
	height: number,
	longEdge: number
): { width: number; height: number } {
	const scale = Math.min(1, longEdge / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

export function centerSquare(
	width: number,
	height: number
): { x: number; y: number; size: number } {
	const size = Math.min(width, height);
	return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

/** Shrinks a picked file in the browser, so phones never upload a full-size photo. */
export async function resizeImage(file: File, spec: ImageSpec): Promise<ResizeResult> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return { ok: false, message: UNREADABLE_IMAGE };
	}
	try {
		const canvas = draw(bitmap, spec);
		for (const quality of QUALITIES) {
			const blob = await encode(canvas, quality);
			if (blob.size <= spec.maxBytes) {
				const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
				return { ok: true, image: new File([blob], `image.${extension}`, { type: blob.type }) };
			}
		}
		return { ok: false, message: OVERSIZED_IMAGE };
	} finally {
		bitmap.close();
	}
}

function draw(bitmap: ImageBitmap, spec: ImageSpec): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) throw new Error('No 2D canvas');
	context.imageSmoothingQuality = 'high';

	if (spec.shape === 'square') {
		const crop = centerSquare(bitmap.width, bitmap.height);
		canvas.width = canvas.height = Math.min(spec.size, crop.size);
		context.drawImage(
			bitmap,
			crop.x,
			crop.y,
			crop.size,
			crop.size,
			0,
			0,
			canvas.width,
			canvas.height
		);
	} else {
		const size = fitWithin(bitmap.width, bitmap.height, spec.size);
		canvas.width = size.width;
		canvas.height = size.height;
		context.drawImage(bitmap, 0, 0, size.width, size.height);
	}
	return canvas;
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	const webp = await toBlob(canvas, 'image/webp', quality);
	// Browsers that cannot encode WebP hand back a PNG instead.
	if (webp.type === 'image/webp') return webp;

	const flat = document.createElement('canvas');
	flat.width = canvas.width;
	flat.height = canvas.height;
	const context = flat.getContext('2d');
	if (!context) throw new Error('No 2D canvas');
	// JPEG has no transparency, and transparent pixels would turn black.
	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, flat.width, flat.height);
	context.drawImage(canvas, 0, 0);
	return toBlob(flat, 'image/jpeg', quality);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Encoding the image failed'))),
			type,
			quality
		);
	});
}
