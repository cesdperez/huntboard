<script lang="ts">
	import { resolve } from '$app/paths';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const event = $derived(pageLayout() === 'event');
</script>

<svelte:head>
	<title>My games · Huntboard</title>
</svelte:head>

{#snippet signedInAs()}
	Signed in as {data.displayName} ({data.email}).
{/snippet}

{#if event}
	<AppBar />
	<PageBanner title="My games">{@render signedInAs()}</PageBanner>
{/if}

<main class="mx-auto flex max-w-content flex-col gap-10 px-gutter {event ? 'py-6' : 'py-10'}">
	<section aria-labelledby="games-heading" class="flex flex-col gap-4">
		{#if event}
			<h2 id="games-heading" class="font-display type-heading">Games</h2>
		{:else}
			<div>
				<h1 id="games-heading" class="type-title">My games</h1>
				<p class="mt-1 type-secondary break-words">{@render signedInAs()}</p>
			</div>
		{/if}

		<Button href={resolve('/new')} variant="primary" size="lg" class="w-full">New game</Button>

		{#if data.games.length > 0}
			<ul aria-label="My games" class="flex flex-col border-t border-line">
				{#each data.games as game (game.adminToken)}
					<li class="border-b border-line">
						<a
							href={resolve('/a/[token]', { token: game.adminToken })}
							class="flex min-h-row items-center justify-between gap-3 py-3 font-semibold"
						>
							<span class="min-w-0 break-words">{game.name}</span>
							<span class="shrink-0 type-secondary">Open</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="type-secondary">
				No games yet. Games made before accounts can be added from their admin link, on the Setup
				tab.
			</p>
		{/if}
	</section>

	<form method="POST" action="/logout">
		<Button type="submit" variant="ghost" class="w-full">Sign out</Button>
	</form>
</main>
