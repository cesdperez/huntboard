<script lang="ts">
	import { pageLayout } from '#lib/themes/page-layout.js';

	let { section }: { section: string } = $props();

	const event = $derived(pageLayout() === 'event');
</script>

{#if event}
	<h2 class="section-heading mt-6 flex items-center gap-2 text-on-section">
		<span aria-hidden="true" class="section-ornament h-7 w-5 shrink-0"></span>
		<span class="min-w-0 break-words">{section}</span>
		<!-- A border, not a filled box: borders snap to device pixels, so the rule never blurs. -->
		<span aria-hidden="true" class="section-rule ml-2 min-w-6 flex-1 border-section-rule"></span>
	</h2>
{:else}
	<h2 class="-mx-gutter mt-4 bg-section px-gutter py-1 font-display type-heading text-on-section">
		{section}
	</h2>
{/if}

<style>
	.section-heading {
		font: var(--section-heading-font);
		letter-spacing: var(--section-heading-tracking);
	}

	.section-ornament {
		order: var(--section-ornament-order);
		background: var(--section-ornament) no-repeat center / contain;
	}

	.section-rule {
		border-top-width: var(--section-rule-width);
	}
</style>
