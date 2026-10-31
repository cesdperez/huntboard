<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolveTheme } from '#lib/themes/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import { cn } from '#lib/utils.js';
	import { wordmarkHome } from './wordmark-home.js';

	type Props = {
		/** Sits at the right end, like the nickname button. */
		children?: Snippet;
		/** Classes for the inner row, which holds the content column. */
		class?: string;
	};

	let { children, class: className }: Props = $props();

	const event = $derived(pageLayout() === 'event');
	const partner = $derived(resolveTheme(page.data.gameTheme).wordmark);
	const home = $derived(
		wordmarkHome({
			routeId: page.route.id,
			params: page.params,
			signedIn: page.data.signedIn ?? false,
			error: page.error !== null
		})
	);
	const here = $derived(page.url.pathname === home);
	const wordmarkClass = $derived(
		cn(
			'app-bar-wordmark inline-flex shrink-0 items-center gap-[0.3em] leading-none font-bold',
			event ? 'font-display text-[20px]' : 'text-[17px]'
		)
	);
</script>

{#snippet mark()}
	Huntboard
	{#if partner}
		<span aria-hidden="true" class="font-sans text-[0.8em] font-normal">×</span>
		<span class="sr-only">with</span>
		<!-- Sized in em, so the big-screen scoreboard scales it with the app bar text. -->
		<img src={partner.src} alt={partner.alt} class="block h-[0.7em] w-auto" />
	{/if}
{/snippet}

<div class={event ? 'surface-app-bar' : 'border-b border-line bg-paper text-ink'}>
	<div
		class={cn(
			'mx-auto flex max-w-content items-center justify-between gap-3 px-gutter',
			event ? 'min-h-12' : 'min-h-11',
			className
		)}
	>
		{#if here}
			<p class={wordmarkClass}>{@render mark()}</p>
		{:else}
			<a href={home} class={cn(wordmarkClass, 'min-h-touch focus-visible:-outline-offset-2')}>
				{@render mark()}
			</a>
		{/if}
		{@render children?.()}
	</div>
</div>
