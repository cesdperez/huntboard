import { describe, expect, it } from 'vitest';
import { moveItem } from './reorder.js';

describe('moveItem', () => {
	it('moves an item up one place', () => {
		expect(moveItem(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
	});

	it('moves an item down one place', () => {
		expect(moveItem(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
	});

	it('leaves the list alone when the item is already at that end', () => {
		expect(moveItem(['a', 'b', 'c'], 'a', -1)).toBeNull();
		expect(moveItem(['a', 'b', 'c'], 'c', 1)).toBeNull();
	});

	it('returns null for an item that is not in the list', () => {
		expect(moveItem(['a', 'b'], 'z', 1)).toBeNull();
	});

	it('does not change the list it was given', () => {
		const items = ['a', 'b'];
		moveItem(items, 'a', 1);
		expect(items).toEqual(['a', 'b']);
	});
});
