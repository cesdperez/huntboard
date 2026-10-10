<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { NicknameButton, NicknamePrompt } from '#lib/components/nickname/index.js';
	import { Toast } from '#lib/components/toast/index.js';
	import { cn } from '#lib/utils.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const token = $derived(data.game.admin_token);
	const tabs = $derived([
		{ label: 'Queue', routeId: '/a/[token]/queue', href: resolve('/a/[token]/queue', { token }) },
		{ label: 'Grid', routeId: '/a/[token]/grid', href: resolve('/a/[token]/grid', { token }) },
		{ label: 'Teams', routeId: '/a/[token]/teams', href: resolve('/a/[token]/teams', { token }) },
		{ label: 'Setup', routeId: '/a/[token]/setup', href: resolve('/a/[token]/setup', { token }) }
	]);
	// The grid is the one admin screen wider than the content column.
	const wide = $derived(page.route.id === '/a/[token]/grid');
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

	<main class={cn('mx-auto w-full flex-1 px-gutter pt-4 pb-28', !wide && 'max-w-content')}>
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
							'flex min-h-row items-center justify-center gap-1.5 font-semibold',
							current ? 'text-ink' : 'text-muted'
						)}
					>
						{tab.label}
						{#if tab.label === 'Queue' && data.pendingCount > 0}
							<span
								class="min-w-6 rounded-full bg-flag px-1.5 text-center text-[13px] leading-6 text-on-flag tabular-nums"
							>
								{data.pendingCount}<span class="sr-only"> to judge</span>
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

<NicknamePrompt />
<Toast class="bottom-[calc(var(--spacing-row)+max(1rem,env(safe-area-inset-bottom)))]" />
