<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { checkConnection, connection, retryPage } from '#lib/components/connection/index.js';
	import { AppBar } from '#lib/components/event/index.js';
	import { startPolling } from '#lib/live-updates.js';
	import { pageLayout } from '#lib/themes/page-layout.js';

	const notFound = $derived(page.status === 404);
	const heading = $derived(
		notFound
			? 'This link does not work'
			: connection.online
				? 'This page did not load'
				: 'You are offline'
	);

	const event = $derived(pageLayout() === 'event');

	onMount(() => {
		if (notFound) return;
		void checkConnection();
		// Only on the polling schedule: retrying at once would loop on an error that persists.
		// A full reload, because the browser keeps failing a page script it could not fetch offline.
		return startPolling(() => retryPage(async () => location.reload()));
	});
</script>

<svelte:head>
	<title>{heading} · Huntboard</title>
</svelte:head>

{#if event}
	<AppBar />
{/if}

<main class="mx-auto flex max-w-content flex-col gap-3 px-gutter py-10">
	<h1 class="type-title">{heading}</h1>
	{#if notFound}
		<p class="type-secondary">
			It may have been replaced with a new one. Ask your organiser for the current link.
		</p>
	{:else if !connection.online}
		<p class="type-secondary">This page loads again once you reconnect.</p>
	{:else}
		<p class="type-secondary">
			It tries again by itself. If it keeps happening, reload the page or tell your organiser.
		</p>
	{/if}
</main>
