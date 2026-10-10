import { defineConfig } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173';
const baseURL = process.env.HUNTBOARD_URL ?? LOCAL_URL;

/** The rehearsal plays a whole game against HUNTBOARD_URL, or the local dev server it starts. */
export default defineConfig({
	testDir: 'e2e',
	timeout: 5 * 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL,
		browserName: 'chromium',
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		trace: 'retain-on-failure'
	},
	webServer: process.env.HUNTBOARD_URL
		? undefined
		: { command: 'pnpm dev', url: LOCAL_URL, reuseExistingServer: true }
});
