import { env } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';
import { measureD1Usage } from '#lib/server/d1-usage.js';

const passThrough: Handle = ({ event, resolve }) => resolve(event);

export const handle = env.LOADTEST_METRICS ? measureD1Usage : passThrough;
