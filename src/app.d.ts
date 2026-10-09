// Cloudflare bindings (env.DB) come from `import { env } from 'cloudflare:workers'`, typed by
// worker-configuration.d.ts (`pnpm gen`). adapter-cloudflare does not populate event.platform.
declare global {
	namespace App {
		interface PageState {
			/** Set when rotating the admin link moved the page to the new link. */
			adminLinkRotated?: boolean;
		}
	}
}

export {};
