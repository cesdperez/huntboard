import { getSignedInUser } from '#lib/server/http/session.js';
import type { LayoutServerLoad } from './$types';

// Reads no URL or params, so it reruns after a form action but not on polls or navigation.
// The session lookup is shared with the page's own load, so it costs no extra D1 read.
export const load: LayoutServerLoad = async (event) => ({
	signedIn: (await getSignedInUser(event)) !== null
});
