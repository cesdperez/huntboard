import { describe, expect, it } from 'vitest';
import { centerSquare, fitWithin } from './image-resize.js';

describe('fitWithin', () => {
	it('scales a portrait image so its long edge fits, keeping the aspect ratio', () => {
		expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
	});

	it('scales a landscape image by its width', () => {
		expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
	});

	it('never scales a small image up', () => {
		expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
	});

	it('keeps a sliver at least one pixel wide', () => {
		expect(fitWithin(10_000, 2, 1600)).toEqual({ width: 1600, height: 1 });
	});
});

describe('centerSquare', () => {
	it('crops the middle of a landscape image', () => {
		expect(centerSquare(400, 300)).toEqual({ x: 50, y: 0, size: 300 });
	});

	it('crops the middle of a portrait image', () => {
		expect(centerSquare(300, 401)).toEqual({ x: 0, y: 50, size: 300 });
	});

	it('takes a square image whole', () => {
		expect(centerSquare(256, 256)).toEqual({ x: 0, y: 0, size: 256 });
	});
});
