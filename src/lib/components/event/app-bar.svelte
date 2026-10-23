<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Sits at the right end, like the nickname button. */
		children?: Snippet;
		/** Classes for the inner row, which holds the content column. */
		class?: string;
	};

	let { children, class: className }: Props = $props();
</script>

<div class="surface-app-bar">
	<div
		class={cn(
			'mx-auto flex min-h-12 max-w-content items-center justify-between gap-3 px-gutter',
			className
		)}
	>
		<p class="font-display text-[20px] leading-none font-bold">Huntboard</p>
		{@render children?.()}
	</div>
</div>
