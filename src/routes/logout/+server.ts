import { redirect } from '@sveltejs/kit';
import { signOut } from '#lib/server/http/session.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	await signOut(cookies);
	redirect(303, '/');
};
