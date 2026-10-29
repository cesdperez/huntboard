<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { runPasskey, type PasskeyIntent } from '#lib/client/passkey.js';
	import { Button, type ButtonVariant } from '#lib/components/ui/button/index.js';

	type Props = {
		intent: PasskeyIntent;
		next?: string;
		variant?: ButtonVariant;
		class?: string;
		/** Reads and checks the display name before a sign-up, or returns null to stop. */
		displayName?: () => string | null;
		onerror: (message: string | null) => void;
		children: Snippet;
	};

	let { intent, next, variant, class: className, displayName, onerror, children }: Props = $props();
	let busy = $state(false);

	async function run() {
		const name = displayName?.();
		if (name === null) return;
		busy = true;
		onerror(null);
		const result = await runPasskey(intent, { displayName: name, next });
		if ('error' in result) {
			busy = false;
			onerror(result.error);
			return;
		}
		// The server only answers with a path on this site, checked by nextPath.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(result.next, { invalidateAll: true });
		busy = false;
	}
</script>

<Button {variant} class={className} disabled={busy} onclick={run}>{@render children()}</Button>
