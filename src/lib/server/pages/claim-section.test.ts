import { describe, expect, it, vi } from 'vitest';
import { getClaimSection } from './claim-section.js';

const sam = { id: 7, email: 'sam@example.com', display_name: 'Sam', created_at: '' };

describe('getClaimSection', () => {
	it('offers the claim to a signed-in visitor of a game nobody owns', async () => {
		expect(await getClaimSection({ owner_user_id: null }, async () => sam)).toBe('claim');
	});

	it('asks a signed-out visitor to sign in first', async () => {
		expect(await getClaimSection({ owner_user_id: null }, async () => null)).toBe('sign-in');
	});

	it('shows nothing for an owned game, without reading the session', async () => {
		const readUser = vi.fn(async () => sam);

		expect(await getClaimSection({ owner_user_id: 3 }, readUser)).toBeNull();
		expect(readUser).not.toHaveBeenCalled();
	});
});
