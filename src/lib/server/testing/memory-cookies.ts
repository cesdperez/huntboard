import type { Cookies } from '@sveltejs/kit';

/** The part of SvelteKit's Cookies the sign-in adapters use, kept in a Map. Tests only. */
export function memoryCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	const cookies = {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => void jar.delete(name)
	};
	return { cookies: cookies as unknown as Cookies, jar };
}
