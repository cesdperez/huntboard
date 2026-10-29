import { fail, redirect, type Action, type Cookies } from '@sveltejs/kit';
import { resendSender } from '../http/email.js';
import { signIn } from '../http/session.js';
import {
	SIGN_IN_MINUTES,
	finishWithCode,
	finishWithLink,
	pendingRequestEmail,
	requestSignIn,
	type FinishResult,
	type SendEmail
} from '../use-cases/email-sign-in.js';
import { readString } from '../use-cases/form.js';

type SignInEnv = Pick<Cloudflare.Env, 'DB' | 'EMAIL_FROM' | 'RESEND_API_KEY'>;

export const NAME_ERROR = 'Type the name to show on your account.';

const REQUEST_COOKIE = 'sign_in_request';

/**
 * The /login actions. With `preview` and no Resend key, no email is sent and the page shows the
 * link and code instead: the dev server passes `dev`, which is false in every production build.
 */
export function emailSignInActions(env: SignInEnv, preview: boolean) {
	const request: Action = async ({ request, cookies, url }) => {
		const email = readString(await request.formData(), 'email');
		const resend = resendSender(env);
		if (!resend && !preview) {
			return fail(503, { email, error: 'Email sign-in is not set up here.' });
		}
		const send: SendEmail = resend ?? (async () => true);

		const result = await requestSignIn(env.DB, send, {
			email,
			next: url.searchParams.get('next'),
			origin: url.origin
		});
		if (result.kind === 'error') return fail(result.status, { email, error: result.message });

		cookies.set(REQUEST_COOKIE, result.requestId, {
			path: '/login',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: SIGN_IN_MINUTES * 60
		});
		return {
			sent: result.email,
			preview: resend ? null : { link: result.link, code: result.code }
		};
	};

	const code: Action = async ({ request, cookies }) => {
		const data = await request.formData();
		const typed = readString(data, 'code');
		const result = await finishWithCode(
			env.DB,
			cookies.get(REQUEST_COOKIE) ?? '',
			typed,
			readString(data, 'displayName')
		);
		if (result.kind === 'signed-in') cookies.delete(REQUEST_COOKIE, { path: '/login' });
		return finishSignIn(cookies, result, data, { code: typed });
	};

	return { request, code };
}

/** The /login/verify action: the link's token, and a name when the address is new. */
export function linkSignInAction(env: Pick<Cloudflare.Env, 'DB'>): Action {
	return async ({ request, cookies }) => {
		const data = await request.formData();
		const result = await finishWithLink(
			env.DB,
			readString(data, 'token'),
			readString(data, 'displayName')
		);
		return finishSignIn(cookies, result, data, {});
	};
}

/** The address this browser asked a code for, while the code still works. */
export async function pendingEmail(
	env: Pick<Cloudflare.Env, 'DB'>,
	cookies: Cookies
): Promise<string | null> {
	const id = cookies.get(REQUEST_COOKIE);
	return id ? pendingRequestEmail(env.DB, id) : null;
}

async function finishSignIn(
	cookies: Cookies,
	result: FinishResult,
	data: FormData,
	kept: Record<string, string>
) {
	if (result.kind === 'signed-in') {
		await signIn(cookies, result.userId);
		redirect(303, result.next);
	}
	if (result.kind === 'error')
		return fail(400, { ...kept, needsName: false, error: result.message });
	// Asking for the name is not an error until the form has sent one.
	return fail(400, {
		...kept,
		needsName: true,
		error: data.has('displayName') ? NAME_ERROR : null
	});
}
