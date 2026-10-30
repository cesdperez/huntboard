import { resolveTheme } from '#lib/themes/index.js';

export interface SignInEmail {
	to: string;
	subject: string;
	text: string;
	html: string;
}

const LIGHT = {
	paper: '#f4f6f1',
	surface: '#ffffff',
	ink: '#1b2230',
	muted: '#5a6270',
	line: '#dde2d8',
	flag: '#b4247e',
	onFlag: '#ffffff',
	banner: '#e3ead9',
	appBarBase: '#1b2230',
	onAppBar: '#ffffff'
};
const DARK: typeof LIGHT = {
	paper: '#121821',
	surface: '#1a222d',
	ink: '#e8ece6',
	muted: '#9aa3ae',
	line: '#2a3441',
	flag: '#f06bb5',
	onFlag: '#1b0f18',
	banner: '#1b2a22',
	appBarBase: '#0c1117',
	onAppBar: '#e8ece6'
};

/**
 * Contour's tokens, which pages without a game wear, keyed by token name. Email clients ignore CSS
 * variables, so these repeat contour.css.
 */
export const SIGN_IN_EMAIL_COLORS = { light: LIGHT, dark: DARK };

const [FONTS] = resolveTheme('contour').fonts;
const SANS = "'Instrument Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BANNER = "'Big Shoulders', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";

/** The sign-in email: a link and a code that each sign in once within `minutes`. */
export function signInEmail(to: string, link: string, code: string, minutes: number): SignInEmail {
	return {
		to,
		subject: 'Sign in to Huntboard',
		text: [
			'Open this link to sign in to Huntboard:',
			link,
			'',
			`Or type this code on the sign-in page: ${code}`,
			'',
			`The link and the code work once, for ${minutes} minutes.`,
			'If you did not ask to sign in, you can ignore this email.'
		].join('\n'),
		html: html(escapeHtml(to), escapeHtml(link), escapeHtml(code), minutes)
	};
}

function html(to: string, link: string, code: string, minutes: number): string {
	const c = LIGHT;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Sign in to Huntboard</title>
<link rel="stylesheet" href="${FONTS}">
<style>${darkStyles()}</style>
</head>
<body class="paper" style="margin:0;padding:0;background:${c.paper};color:${c.ink};font-family:${SANS};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your sign-in code is ${code}. It works once, for ${minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="paper" style="background:${c.paper};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:separate;">
<tr><td class="app-bar" style="background:${c.appBarBase};color:${c.onAppBar};padding:14px 24px;border-radius:14px 14px 0 0;font-family:${SANS};font-size:20px;line-height:1;font-weight:700;">Huntboard</td></tr>
<tr><td class="banner" style="background:${c.banner};color:${c.ink};padding:28px 24px 24px;">
<span class="ring" style="display:inline-block;width:22px;height:22px;border:4px solid ${c.flag};border-radius:50%;vertical-align:middle;margin-right:12px;"></span><h1 class="ink" style="display:inline;margin:0;font-family:${BANNER};font-size:56px;line-height:0.9;font-weight:800;letter-spacing:-0.01em;vertical-align:middle;color:${c.ink};">Sign in</h1>
<p class="ink" style="margin:12px 0 0;font-size:17px;line-height:1.35;font-weight:600;color:${c.ink};">For ${to}</p>
</td></tr>
<tr><td class="surface" style="background:${c.surface};padding:28px 24px 8px;border-radius:0 0 14px 14px;">
<p class="ink" style="margin:0 0 20px;font-size:17px;line-height:1.4;color:${c.ink};">Press the button to sign in to Huntboard.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="button" style="background:${c.flag};border-radius:10px;">
<a href="${link}" class="button-text" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:17px;line-height:18px;font-weight:600;color:${c.onFlag};text-decoration:none;border-radius:10px;">Sign in</a>
</td></tr></table>
<p class="ink" style="margin:28px 0 8px;font-size:17px;line-height:1.4;color:${c.ink};">Or type this code on the sign-in page:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="code" style="border:2px solid ${c.line};border-radius:10px;padding:10px 18px;">
<p class="ink" style="margin:0;font-family:${BANNER};font-size:40px;line-height:1;font-weight:800;letter-spacing:0.12em;font-variant-numeric:tabular-nums;color:${c.ink};">${code}</p>
</td></tr></table>
<p class="muted" style="margin:28px 0 0;font-size:15px;line-height:1.4;color:${c.muted};">The link and the code work once, for ${minutes} minutes. If you did not ask to sign in, you can ignore this email.</p>
<p class="muted" style="margin:16px 0 20px;padding-top:16px;border-top:1px solid ${c.line};font-size:13px;line-height:1.4;color:${c.muted};">If the button does not open, copy this link:<br><a href="${link}" class="muted" style="color:${c.muted};">${breakable(link)}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Inline styles carry the light colours. Clients that read <style> and the media query swap them.
function darkStyles(): string {
	const d = DARK;
	return `:root{color-scheme:light dark;supported-color-schemes:light dark;}
@media (prefers-color-scheme: dark){
.paper{background:${d.paper} !important;}
.app-bar{background:${d.appBarBase} !important;color:${d.onAppBar} !important;}
.banner{background:${d.banner} !important;}
.surface{background:${d.surface} !important;}
.ink{color:${d.ink} !important;}
.muted{color:${d.muted} !important;border-color:${d.line} !important;}
.ring{border-color:${d.flag} !important;}
.button{background:${d.flag} !important;}
.button-text{color:${d.onFlag} !important;}
.code{border-color:${d.line} !important;}
}`;
}

// Only after separators: a break anywhere else splits a word of the link in two.
function breakable(url: string): string {
	return url.replace(/:\/\/|\/|\?|=|&amp;/g, '$&<wbr>');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
