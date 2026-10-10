import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { findTeamLink, type TeamLink } from './team-page.js';

/** The team and game a team token opens. Throws a 404 for an unknown or rotated token. */
export async function requireTeamLink(token: string): Promise<TeamLink> {
	const link = await findTeamLink(env.DB, token);
	if (!link) error(404, 'Not found');
	return link;
}
