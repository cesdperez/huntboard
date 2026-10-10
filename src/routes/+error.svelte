<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { checkConnection, connection, retryPage } from '#lib/components/connection/index.js';
	import { startPolling } from '#lib/live-updates.js';

	const notFound = $derived(page.status === 404);

	onMount(() => {
		if (notFound) return;
		void checkConnection();
		// Only on the polling schedule: retrying at once would loop on an error that persists.
		// A full reload, because the browser keeps failing a page script it could not fetch offline.
		return startPolling(() => retryPage(async () => location.reload()));
	});
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
	{:else if !connection.online}
		<h1 class="type-title">You are offline</h1>
		<p class="type-secondary">This page loads again once you reconnect.</p>
	{:else}
		<h1 class="type-title">This page did not load</h1>
		<p class="type-secondary">
			It tries again by itself. If it keeps happening, reload the page or tell your organiser.
		</p>
	{/if}
</main>
