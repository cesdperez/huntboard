// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// Cloudflare bindings (env.DB) come from `import { env } from 'cloudflare:workers'`, typed by
// worker-configuration.d.ts (`pnpm gen`). adapter-cloudflare does not populate event.platform.
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
