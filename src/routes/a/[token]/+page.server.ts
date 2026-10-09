import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// Waiting for the layout makes an unknown token a 404 here instead of a redirect to one.
	await parent();
	redirect(307, resolve('/a/[token]/setup', { token: params.token }));
};
