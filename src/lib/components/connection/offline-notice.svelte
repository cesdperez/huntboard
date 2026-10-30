<script lang="ts">
	import RefreshCwOffIcon from '@lucide/svelte/icons/refresh-cw-off';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { cn } from '#lib/utils.js';
	import { checkConnection, connection } from './connection.svelte.js';

	let { class: className }: { class?: string } = $props();
</script>

<!-- Pages that do not poll still clear the notice once the browser is back online. -->
<svelte:window
	onoffline={() => (connection.online = false)}
	ononline={() => void checkConnection()}
/>

<!-- The live region stays mounted so screen readers hear the notice when it appears. -->
<div role="status" class={cn(connection.online && !connection.stale && 'sr-only', className)}>
	{#if !connection.online}
		<p class="flex items-center gap-2 text-[15px] font-semibold">
			<WifiOffIcon aria-hidden="true" class="size-4 shrink-0" />
			You are offline. This page updates again once you reconnect.
		</p>
	{:else if connection.stale}
		<p class="flex items-center gap-2 text-[15px] font-semibold">
			<RefreshCwOffIcon aria-hidden="true" class="size-4 shrink-0" />
			This page did not update. It tries again by itself.
		</p>
	{/if}
</div>
