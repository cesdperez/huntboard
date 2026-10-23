// Draws each theme's touch icon from its icon.svg, and its link preview image from the card below.
// Run with `node scripts/theme-images.ts` after changing a theme's look. Needs network for fonts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { THEMES, themeImages, type Theme } from '../src/lib/themes/index.ts';

const STATIC_DIR = path.join(import.meta.dirname, '../static');
const TOUCH_ICON_SIZE = 180;
// WhatsApp, iMessage and Slack all show 1.91:1 previews without cropping.
const SHARE_SIZE = { width: 1200, height: 630 };

const THISTLE = `<svg viewBox="0 0 64 112" fill="none" stroke="#151515" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 44V14M28 44L22 16M36 44L42 16M25 44L14 22M39 44L50 22M23 44L10 31M41 44L54 31"/><path d="M18 44H46M18 44L14 39M46 44L50 39"/><path d="M21 44C21 54 26 60 32 60S43 54 43 44"/><path d="M24 47L35 59M30 45L41 52M40 47L29 59M34 45L23 52"/><path d="M32 60C33 76 31 94 32 112"/><path d="M32 94C24 92 16 86 9 74L16 77L13 68L20 73L20 64L26 72L27 64L29 76C30 84 31 89 32 94"/><path d="M32 80C40 78 48 72 55 61L48 64L51 55L44 61L44 52L38 60L37 52L35 64C34 70 33 76 32 80"/></svg>`;

interface ThemeArt {
	/** Fills the touch icon's square, since iOS rounds the corners itself. */
	touchBackground: string;
	shareCard: string;
}

const ART: Record<string, ThemeArt> = {
	'highland-bru': {
		touchBackground: '#ff741f',
		shareCard: `
			<style>
				body { background: #ff741f; color: #151515; font-family: 'Barlow', sans-serif; }
				.bar {
					height: 112px; padding: 0 72px; display: flex; align-items: center;
					color: #fff; font: 700 52px 'Fraunces', serif;
					background:
						repeating-linear-gradient(90deg, transparent 0 26px, rgb(178 34 52 / 0.6) 26px 30px,
							transparent 30px 42px, rgb(18 75 204 / 0.35) 42px 66px, transparent 66px 88px),
						repeating-linear-gradient(0deg, transparent 0 26px, rgb(178 34 52 / 0.6) 26px 30px,
							transparent 30px 42px, rgb(18 75 204 / 0.35) 42px 66px, transparent 66px 88px),
						#10241b;
				}
				.banner { height: 384px; padding: 28px 72px 0; display: flex; justify-content: space-between; }
				h1 { margin: 0; font: 400 168px/0.82 'Jersey 10', monospace; }
				p { margin: 24px 0 0; font-weight: 600; font-size: 40px; }
				.thistle { width: 180px; flex-shrink: 0; }
				.strip {
					height: 134px; padding: 0 72px; display: flex; align-items: center; gap: 28px;
					background: #124bcc; color: #fff;
				}
				.rank { font: 700 52px 'Fraunces', serif; padding-right: 28px; border-right: 2px solid #4a74d9; }
				.team { flex: 1; font: 600 44px 'Fraunces', serif; }
				.score { font: 800 92px 'Barlow Condensed', sans-serif; }
			</style>
			<div class="bar">Huntboard</div>
			<div class="banner">
				<div>
					<h1>SCAVENGER<br>HUNT</h1>
					<p>Claim challenges. Climb the leaderboard.</p>
				</div>
				<div class="thistle">${THISTLE}</div>
			</div>
			<div class="strip">
				<span class="rank">1st</span>
				<span class="team">Your team</span>
				<span class="score">180</span>
			</div>`
	},
	flag: {
		touchBackground: '#f5f7fa',
		shareCard: `
			<style>
				body {
					background: #f5f7fa; color: #14213d; font-family: 'Archivo', sans-serif;
					display: flex; align-items: center; gap: 56px; padding: 0 80px;
				}
				img { width: 240px; height: 240px; flex-shrink: 0; }
				h1 { margin: 0; font-size: 96px; font-weight: 800; font-stretch: 125%; line-height: 1; }
				p { margin: 24px 0 0; font-size: 36px; font-weight: 450; color: #5b6578; line-height: 1.3; }
			</style>
			<img src="data:image/svg+xml;base64,${iconBase64('flag')}" alt="">
			<div>
				<h1>Huntboard</h1>
				<p>A live scoreboard for team scavenger hunts.</p>
			</div>`
	}
};

function staticPath(file: string) {
	return path.join(STATIC_DIR, file);
}

function iconBase64(id: string) {
	return readFileSync(staticPath(`/themes/${id}/icon.svg`)).toString('base64');
}

function page(theme: Theme, body: string) {
	const fonts = theme.fonts.map((href) => `<link rel="stylesheet" href="${href}">`).join('');
	return `<!doctype html><html><head>${fonts}<style>* { box-sizing: border-box; } body { margin: 0; height: 100vh; overflow: hidden; }</style></head><body>${body}</body></html>`;
}

const browser = await chromium.launch();
try {
	for (const theme of THEMES) {
		const art = ART[theme.id];
		if (!art) throw new Error(`No art for theme ${theme.id}`);
		const images = themeImages(theme);

		const icon = await browser.newPage({
			viewport: { width: TOUCH_ICON_SIZE, height: TOUCH_ICON_SIZE }
		});
		await icon.setContent(
			page(
				theme,
				`<div style="background:${art.touchBackground};height:100%;padding:16px"><img src="data:image/svg+xml;base64,${iconBase64(theme.id)}" style="width:100%;height:100%;display:block"></div>`
			)
		);
		await icon.screenshot({ path: staticPath(images.touchIcon) });

		const share = await browser.newPage({ viewport: SHARE_SIZE });
		await share.setContent(page(theme, art.shareCard), { waitUntil: 'networkidle' });
		await share.evaluate(() => document.fonts.ready);
		await share.screenshot({ path: staticPath(images.share) });
	}
} finally {
	await browser.close();
}
