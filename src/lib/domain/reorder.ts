/** A copy of items with item moved by offset places, or null when it is missing or would leave the list. */
export function moveItem<T>(items: readonly T[], item: T, offset: number): T[] | null {
	const from = items.indexOf(item);
	const to = from + offset;
	if (from === -1 || to < 0 || to >= items.length) return null;
	const moved = items.toSpliced(from, 1);
	moved.splice(to, 0, item);
	return moved;
}
