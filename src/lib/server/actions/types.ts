import type { Action } from '@sveltejs/kit';

/** A form action on an admin page. params.token is the admin token: pass it to requireAdminGame. */
export type AdminAction = Action<{ token: string }>;

export type AdminActions = Record<string, AdminAction>;
