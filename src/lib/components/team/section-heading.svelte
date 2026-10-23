<script lang="ts">
	import { pageLayout } from '#lib/themes/page-layout.js';

	let { section }: { section: string } = $props();

	const event = $derived(pageLayout() === 'event');
</script>

{#if event}
	<h2 class="mt-6 flex items-center gap-2 font-display text-[26px] leading-tight font-bold">
		<span aria-hidden="true" class="section-ornament h-7 w-5 shrink-0"></span>
		<span class="min-w-0 break-words">{section}</span>
		<span aria-hidden="true" class="ml-2 h-px min-w-6 flex-1 bg-section-rule"></span>
	</h2>
{:else}
	<h2 class="-mx-gutter mt-4 bg-section px-gutter py-1 font-display type-heading text-on-section">
		{section}
	</h2>
{/if}

<style>
	.section-ornament {
		background: var(--section-ornament) no-repeat center / contain;
	}
</style>
