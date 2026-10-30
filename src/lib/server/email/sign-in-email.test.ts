import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGN_IN_EMAIL_COLORS, signInEmail } from './sign-in-email.js';

const LINK = 'https://huntboard.example/login/verify?token=abc_DEF-123';
const email = signInEmail('sam@example.com', LINK, '042917', 15);

describe('signInEmail', () => {
	it('addresses the email and names the app in the subject', () => {
		expect(email.to).toBe('sam@example.com');
		expect(email.subject).toBe('Sign in to Huntboard');
	});

	it('keeps a plain-text part with the link, the code and how long they work', () => {
		expect(email.text).toBe(
			[
				'Open this link to sign in to Huntboard:',
				LINK,
				'',
				'Or type this code on the sign-in page: 042917',
				'',
				'The link and the code work once, for 15 minutes.',
				'If you did not ask to sign in, you can ignore this email.'
			].join('\n')
		);
	});

	it('puts the link behind a Sign in button and spells it out for clients that drop the button', () => {
		expect(email.html.split(`href="${LINK}"`)).toHaveLength(3);
		expect(email.html).toMatch(/>\s*Sign in\s*<\/a>/);
	});

	it('shows the code and the address the email went to', () => {
		expect(email.html).toContain('>042917<');
		expect(email.html).toContain('sam@example.com');
		expect(email.html).toContain('work once, for 15 minutes');
	});

	it('follows the phone into dark mode', () => {
		expect(email.html).toContain('<meta name="color-scheme" content="light dark">');
		expect(email.html).toContain('@media (prefers-color-scheme: dark)');
	});

	it.each(['light', 'dark'] as const)('repeats the Contour %s colours from contour.css', (mode) => {
		const css = readFileSync(
			path.join(import.meta.dirname, '../../themes/contour.css'),
			'utf8'
		).split('@variant dark');
		const block = mode === 'light' ? css[0] : css[1];
		for (const [key, colour] of Object.entries(SIGN_IN_EMAIL_COLORS[mode])) {
			const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
			expect(block, `--${name}`).toMatch(new RegExp(`--${name}:\\s*${colour};`, 'i'));
			expect(email.html).toContain(colour);
		}
	});

	it('lets the spelled-out link wrap only after its separators, so no word splits', () => {
		const html = signInEmail('sam@example.com', 'https://x.example/login?a=1&b=2', '0', 15).html;

		expect(html).toContain(
			'>https://<wbr>x.example/<wbr>login?<wbr>a=<wbr>1&amp;<wbr>b=<wbr>2</a>'
		);
		expect(html).not.toContain('break-all');
	});

	it('escapes what it puts into the markup', () => {
		const html = signInEmail('a&b@example.com', 'https://x.example/?a=1&b="2"', '000000', 15).html;

		expect(html).toContain('a&amp;b@example.com');
		expect(html).toContain('href="https://x.example/?a=1&amp;b=&quot;2&quot;"');
		expect(html).not.toContain('a&b@');
	});
});
