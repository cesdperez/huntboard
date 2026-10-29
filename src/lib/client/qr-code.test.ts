import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { QUIET_ZONE, qrCode } from './qr-code.js';

const LINK = 'https://huntboard.example.com/s/3f9c2a7e0b1d4c6a8e5f7a9b0c1d2e3f';

type Run = { x: number; y: number; width: number };

function runs(path: string): Run[] {
	return [...path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)].map(([, x, y, width]) => ({
		x: Number(x),
		y: Number(y),
		width: Number(width)
	}));
}

describe('qrCode', () => {
	it('draws every dark module of the encoded link, and nothing else', () => {
		const { path } = qrCode(LINK);
		const dark = encode(LINK, { ecc: 'M', border: QUIET_ZONE }).data.flat().filter(Boolean).length;

		expect(path.replace(/M\d+ \d+h\d+v1h-\d+z/g, '')).toBe('');
		expect(runs(path).reduce((sum, run) => sum + run.width, 0)).toBe(dark);
	});

	it('leaves a light quiet zone around the code, so a scanner finds its edges on any background', () => {
		const { size, path } = qrCode(LINK);
		const inner = size - QUIET_ZONE;

		for (const run of runs(path)) {
			expect(run.x).toBeGreaterThanOrEqual(QUIET_ZONE);
			expect(run.y).toBeGreaterThanOrEqual(QUIET_ZONE);
			expect(run.x + run.width).toBeLessThanOrEqual(inner);
			expect(run.y).toBeLessThan(inner);
		}
		expect(runs(path)[0]).toEqual({ x: QUIET_ZONE, y: QUIET_ZONE, width: 7 });
	});
});
