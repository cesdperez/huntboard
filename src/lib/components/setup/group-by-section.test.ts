import { describe, expect, it } from 'vitest';
import { groupBySection } from './group-by-section.js';

describe('groupBySection', () => {
	it('groups consecutive items that share a section, keeping their order', () => {
		const items = [
			{ title: 'a', section: null },
			{ title: 'b', section: 'Food' },
			{ title: 'c', section: 'Food' },
			{ title: 'd', section: 'Town' },
			{ title: 'e', section: 'Food' }
		];

		expect(groupBySection(items)).toEqual([
			{ section: null, items: [items[0]] },
			{ section: 'Food', items: [items[1], items[2]] },
			{ section: 'Town', items: [items[3]] },
			{ section: 'Food', items: [items[4]] }
		]);
	});

	it('returns no groups for no items', () => {
		expect(groupBySection([])).toEqual([]);
	});
});
