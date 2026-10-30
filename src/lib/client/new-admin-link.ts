// A rotate whose answer is lost may have killed the admin link this tab is on. The browser made
// the new token, so the tab keeps it until the new link is known to work, a reload and a dead
// link page included.

type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const key = (oldToken: string) => `huntboard:new-admin-token:${oldToken}`;

function tabStorage(): TabStorage | null {
	try {
		return sessionStorage;
	} catch {
		return null;
	}
}

/** The admin token sent to replace oldToken, until the new link is confirmed or the rotate failed. */
export function newAdminToken(oldToken: string, storage = tabStorage()): string | null {
	try {
		return storage?.getItem(key(oldToken)) ?? null;
	} catch {
		return null;
	}
}

export function rememberNewAdminToken(
	oldToken: string,
	newToken: string,
	storage = tabStorage()
): void {
	try {
		storage?.setItem(key(oldToken), newToken);
	} catch {
		// Storage full or refused: the page still holds the token while it stays open.
	}
}

export function forgetNewAdminToken(oldToken: string, storage = tabStorage()): void {
	try {
		storage?.removeItem(key(oldToken));
	} catch {
		// Nothing was kept.
	}
}

/** What a rotate whose answer was lost did, told by which of the two links opens. */
export type Rotation = 'moved' | 'kept' | 'unknown';

export async function checkRotation(
	oldToken: string,
	newToken: string,
	opens: (token: string) => Promise<boolean>
): Promise<Rotation> {
	const [moved, kept] = await Promise.all([opens(newToken), opens(oldToken)]);
	if (moved) return 'moved';
	return kept ? 'kept' : 'unknown';
}
