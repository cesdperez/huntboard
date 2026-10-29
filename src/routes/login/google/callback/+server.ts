import { env } from 'cloudflare:workers';
import { googleCallback } from '#lib/server/actions/sign-in.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = googleCallback(env);
