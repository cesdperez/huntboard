<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { resolveTheme } from '#lib/themes/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Sits at the right end, like the nickname button. */
		children?: Snippet;
		/** Classes for the inner row, which holds the content column. */
		class?: string;
	};

	let { children, class: className }: Props = $props();

	const wordmark = $derived(resolveTheme(page.data.gameTheme).wordmark);
	const home = $derived(page.route.id === '/');
	const wordmarkClass = 'app-bar-wordmark font-display text-[20px] leading-none font-bold';
</script>

{#snippet mark()}
	{#if wordmark}
		<!-- Sized in em, so the big-screen scoreboard scales it with the app bar text. -->
		<img src={wordmark.src} alt={wordmark.alt} class="block h-[0.9em] w-auto" />
	{:else}
		Huntboard
	{/if}
{/snippet}

<div class="surface-app-bar">
	<div
		class={cn(
			'mx-auto flex min-h-12 max-w-content items-center justify-between gap-3 px-gutter',
			className
		)}
	>
		{#if home}
			<p class={wordmarkClass}>{@render mark()}</p>
		{:else}
			<a
				href={resolve('/')}
				class={cn(
					wordmarkClass,
					'inline-flex min-h-touch items-center focus-visible:-outline-offset-2'
				)}
			>
				{@render mark()}
			</a>
		{/if}
		{@render children?.()}
	</div>
</div>
