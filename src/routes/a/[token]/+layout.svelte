<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { NicknameButton, NicknamePrompt } from '#lib/components/nickname/index.js';
	import { cn } from '#lib/utils.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Queue, Grid and Teams join this list as their screens are built.
	const tabs = $derived([
		{
			label: 'Setup',
			routeId: '/a/[token]/setup',
			href: resolve('/a/[token]/setup', { token: data.game.admin_token })
		}
	]);
</script>

<svelte:head>
	<title>{data.game.name} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<header
		class="mx-auto flex w-full max-w-content items-center justify-between gap-3 px-gutter pt-4"
	>
		<p class="truncate type-secondary">{data.game.name}</p>
		<NicknameButton />
	</header>

	<main class="mx-auto w-full max-w-content flex-1 px-gutter pt-4 pb-28">
		{@render children()}
	</main>

	<nav
		aria-label="Admin"
		class="fixed inset-x-0 bottom-0 z-40 border-t bg-surface pb-[env(safe-area-inset-bottom)]"
	>
		<ul class="mx-auto flex max-w-content">
			{#each tabs as tab (tab.routeId)}
				{@const current = page.route.id === tab.routeId}
				<li class="flex-1">
					<a
						href={tab.href}
						aria-current={current ? 'page' : undefined}
						class={cn(
							'flex min-h-row items-center justify-center font-semibold',
							current ? 'text-ink' : 'text-muted'
						)}
					>
						{tab.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

<NicknamePrompt />
