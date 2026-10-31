import { env } from 'cloudflare:workers';
import type { Cookies } from '@sveltejs/kit';
import * as session from './session-cookies.js';

/** The session cookie helpers on the Worker's database. The logic is in session-cookies.ts. */
export const getSignedInUser = (request: session.SessionRequest) =>
	session.getSignedInUser(env.DB, request);

export const requireUser = (request: session.SessionRequest & { url: URL }) =>
	session.requireUser(env.DB, request);

export const signIn = (cookies: Cookies, userId: number) => session.signIn(env.DB, cookies, userId);

export const signOut = (cookies: Cookies) => session.signOut(env.DB, cookies);
