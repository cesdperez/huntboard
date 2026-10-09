<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Link not found' : 'Page did not load'} · Huntboard</title>
</svelte:head>

<main class="mx-auto flex max-w-content flex-col gap-3 px-gutter py-10">
	{#if notFound}
		<h1 class="type-title">This link does not work</h1>
		<p class="type-secondary">
			It may have been replaced with a new one. Ask your organiser for the current link.
		</p>
	{:else}
		<h1 class="type-title">This page did not load</h1>
		<p class="type-secondary">Reload the page. If it keeps happening, tell your organiser.</p>
	{/if}
</main>
