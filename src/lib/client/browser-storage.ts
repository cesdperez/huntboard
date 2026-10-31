export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** This browser's localStorage, or null where reading it throws, as with blocked cookies. */
export function browserStorage(): BrowserStorage | null {
	try {
		return localStorage;
	} catch {
		return null;
	}
}
