<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { checkConnection, connection, retryPage } from '#lib/components/connection/index.js';
	import { AppBar } from '#lib/components/event/index.js';
	import { startPolling } from '#lib/client/live-updates.js';
	import { newAdminToken } from '#lib/client/new-admin-link.js';
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

	// This tab rotated the admin link and lost the answer, so the link it is on may be the old one.
	let newToken = $state<string | null>(null);

	onMount(() => {
		const token = page.route.id?.startsWith('/a/[token]') ? page.params.token : undefined;
		if (notFound && token) newToken = newAdminToken(token);
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
	<header><AppBar /></header>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-3 px-gutter py-10">
	<h1 class="type-title">{heading}</h1>
	{#if newToken}
		<p class="type-secondary">
			This tab rotated the admin link, so it was probably replaced by the new one.
		</p>
		<p>
			<a
				href={resolve('/a/[token]/setup', { token: newToken })}
				data-sveltekit-replacestate
				class="inline-flex min-h-touch items-center font-semibold text-ink underline"
				>Open the new admin link</a
			>
		</p>
	{:else if notFound}
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
	<p>
		<a
			href={resolve('/')}
			class="inline-flex min-h-touch items-center font-semibold text-ink underline"
			>Go to the home page</a
		>
	</p>
</main>
