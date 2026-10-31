import { env } from 'cloudflare:workers';
import { createJoinTeamAction } from '#lib/server/actions/join-team.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: createJoinTeamAction(env)
};
