<script lang="ts">
	import { resolve } from '$app/paths';
	import PasskeyButton from '#lib/components/account/passkey-button.svelte';
	import { AppBar, PageBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let methodError = $state<string | null>(null);

	const event = $derived(pageLayout() === 'event');
	const hasGoogle = $derived(data.methods.some((method) => method.provider === 'google'));
	const shownMethodError = $derived(methodError ?? data.error);

	const methodName = { google: 'Google', passkey: 'Passkey', test: 'Test sign-in' } as const;
</script>

<svelte:head>
	<title>My games · Huntboard</title>
</svelte:head>

{#snippet signedInAs()}
	Signed in as {data.displayName}.
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
				<p class="mt-1 type-secondary">{@render signedInAs()}</p>
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

	<section aria-labelledby="methods-heading" class="flex flex-col gap-4">
		<h2 id="methods-heading" class="font-display type-heading">Ways to sign in</h2>
		<p class="type-secondary">Add a second way, so you can still get in if you lose one.</p>

		<ul aria-label="Ways to sign in" class="flex flex-col border-t border-line">
			{#each data.methods as method, index (index)}
				<li class="flex min-h-row flex-col justify-center border-b border-line py-2">
					<span class="font-semibold">{methodName[method.provider]}</span>
					{#if method.label}
						<span class="type-secondary break-words">{method.label}</span>
					{/if}
				</li>
			{/each}
		</ul>

		{#if shownMethodError}
			<p class="text-[15px] text-danger" role="alert">{shownMethodError}</p>
		{/if}

		<div class="flex flex-col gap-3">
			<PasskeyButton intent="link" class="w-full" onerror={(message) => (methodError = message)}>
				Add a passkey
			</PasskeyButton>
			{#if data.googleEnabled && !hasGoogle}
				<form method="POST" action="/login?/google">
					<input type="hidden" name="intent" value="link" />
					<Button type="submit" class="w-full">Add Google</Button>
				</form>
			{/if}
		</div>
	</section>

	<form method="POST" action="/logout">
		<Button type="submit" variant="ghost" class="w-full">Sign out</Button>
	</form>
</main>
