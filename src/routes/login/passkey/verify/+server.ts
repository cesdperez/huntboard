import { passkeyVerify } from '#lib/server/actions/passkeys.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = passkeyVerify;
