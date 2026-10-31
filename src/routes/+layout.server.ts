import { getSignedInUser } from '#lib/server/http/session.js';
import type { LayoutServerLoad } from './$types';

// Reads no URL or params, so it runs once per full page load and never on polls or navigation.
export const load: LayoutServerLoad = async ({ cookies }) => ({
	signedIn: (await getSignedInUser(cookies)) !== null
});
