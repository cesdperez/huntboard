import type { ColorMode } from '#lib/themes/index.js';

// Cloudflare bindings (env.DB) come from `import { env } from 'cloudflare:workers'`, typed by
// worker-configuration.d.ts (`pnpm gen`). adapter-cloudflare does not populate event.platform.
declare global {
	namespace App {
		/** Set by the loads of themed pages, for the <html> attributes the server renders. */
		interface Locals {
			gameTheme?: string;
			colorMode?: ColorMode;
		}
		/** The same values, for the root layout to apply after client-side navigation. */
		interface PageData {
			gameTheme?: string;
			colorMode?: ColorMode;
		}
		interface PageState {
			/** Set when rotating the admin link moved the page to the new link. */
			adminLinkRotated?: boolean;
		}
	}
}

export {};
