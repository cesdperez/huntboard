export interface SectionGroup<T> {
	section: string | null;
	items: T[];
}

/** Groups runs of items under their section heading, the way the pasted list reads. */
export function groupBySection<T extends { section: string | null }>(
	items: readonly T[]
): SectionGroup<T>[] {
	const groups: SectionGroup<T>[] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (last && last.section === item.section) last.items.push(item);
		else groups.push({ section: item.section, items: [item] });
	}
	return groups;
}
