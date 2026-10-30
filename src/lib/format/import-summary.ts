import type { ImportPreview, ImportPreviewRow } from '#lib/domain/challenge-import.js';
import { plural } from './plural.js';

/** "2 new challenges, 1 challenge updated, a new order.", or null for an empty list. */
export function importSummary(preview: ImportPreview): string | null {
	if (preview.rows.length === 0) return null;
	const count = (change: ImportPreviewRow['change']) =>
		preview.rows.filter((row) => row.change === change).length;
	const added = count('new');
	const updated = count('updated');
	const deleted = preview.deleted.length + preview.deletedWithClaims.length;
	const parts = [
		added > 0 && plural(added, 'new challenge'),
		updated > 0 && `${plural(updated, 'challenge')} updated`,
		deleted > 0 && `${plural(deleted, 'challenge')} deleted`,
		preview.reordered && 'a new order'
	].filter((part) => part !== false);
	return parts.length > 0 ? `${parts.join(', ')}.` : 'No changes.';
}
