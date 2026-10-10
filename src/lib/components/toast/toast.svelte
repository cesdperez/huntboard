<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { toast } from './toast-store.svelte.js';

	/** class can lift the toast above a bottom bar. */
	let { class: className }: { class?: string } = $props();
</script>

<!-- The live region stays mounted so screen readers pick up each message as it appears. -->
<div
	role="status"
	aria-live="polite"
	class={cn(
		'pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-content justify-center px-gutter',
		className
	)}
>
	{#if toast.message}
		{#key toast.id}
			<p
				class="animate-in rounded-full bg-ink px-4 py-3 font-semibold text-paper duration-150 fade-in slide-in-from-bottom-2"
			>
				{toast.message}
			</p>
		{/key}
	{/if}
</div>
