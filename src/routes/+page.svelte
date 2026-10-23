<script lang="ts">
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';

	const event = $derived(pageLayout() === 'event');
</script>

<svelte:head>
	<title>Huntboard</title>
</svelte:head>

{#snippet intro()}
	A live scoreboard for team scavenger hunts.
{/snippet}

{#if event}
	<AppBar />
	<PageBanner title="Huntboard">{@render intro()}</PageBanner>
	<main class="mx-auto max-w-content px-gutter py-8">
		<p class="type-body">Ask your organiser for your team's link.</p>
	</main>
{:else}
	<main class="mx-auto max-w-content px-gutter py-10">
		<h1 class="type-title">Huntboard</h1>
		<p class="mt-3 type-secondary">
			{@render intro()} Ask your organiser for your team's link.
		</p>
	</main>
{/if}
