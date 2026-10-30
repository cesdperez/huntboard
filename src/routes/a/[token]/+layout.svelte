<script lang="ts">
	import ClockIcon from '@lucide/svelte/icons/clock';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { OfflineNotice } from '#lib/components/connection/index.js';
	import { AppBar } from '#lib/components/event/index.js';
	import { NicknameButton, NicknamePrompt } from '#lib/components/nickname/index.js';
	import { Toast } from '#lib/components/toast/index.js';
	import { GameClock, setGameClock } from '#lib/client/game-clock.svelte.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import { cn } from '#lib/utils.js';
	import { isolate } from '#lib/format/text.js';
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
	const event = $derived(pageLayout() === 'event');

	const clock = setGameClock(
		new GameClock(() => ({
			startsAt: data.game.starts_at,
			endsAt: data.game.ends_at
		}))
	);
	onMount(() => clock.start());
</script>

<svelte:head>
	<title>{isolate(data.game.name)} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	{#if event}
		<!-- Judging is fast work on a phone, so the event banner shrinks to one row here. -->
		<header>
			<AppBar><NicknameButton /></AppBar>
			<div class="surface-banner">
				<div
					class="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-3 px-gutter py-2"
				>
					<p
						class="banner-glyph-room line-clamp-2 min-w-0 type-banner text-[32px] leading-[max(1,var(--banner-title-leading))] break-words hyphens-auto"
						title={data.game.name}
					>
						{data.game.name}
					</p>
					<p class="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums">
						<ClockIcon aria-hidden="true" class="size-4 shrink-0" />
						{clock.countdown ?? ' '}
					</p>
				</div>
			</div>
		</header>
	{:else}
		<header
			class="mx-auto flex w-full max-w-content items-center justify-between gap-3 px-gutter pt-4"
		>
			<div class="flex min-w-0 flex-col">
				<p class="truncate type-secondary">{data.game.name}</p>
				<p class="type-secondary tabular-nums">{clock.countdown ?? ' '}</p>
			</div>
			<NicknameButton />
		</header>
	{/if}
	<OfflineNotice class="mx-auto w-full max-w-content px-gutter pt-2" />

	<main class={cn('mx-auto w-full flex-1 px-gutter pt-4 pb-28', !wide && 'max-w-content')}>
		{@render children()}
	</main>

	<nav
		data-bottom-bar
		aria-label="Admin"
		class="fixed inset-x-0 bottom-0 z-40 border-t surface-strip pb-[env(safe-area-inset-bottom)]"
	>
		<ul class="mx-auto flex max-w-content">
			{#each tabs as tab (tab.routeId)}
				{@const current = page.route.id === tab.routeId}
				<li class="flex-1">
					<a
						href={tab.href}
						aria-current={current ? 'page' : undefined}
						class={cn(
							'flex min-h-row items-center justify-center gap-1.5 font-semibold focus-visible:-outline-offset-4',
							current ? 'text-ink' : 'text-muted',
							// Ink is the strip's text colour here, so the bar keeps 3:1 on the strip in any theme.
							event && current && 'shadow-[inset_0_4px_0_var(--ink)]'
						)}
					>
						{tab.label}
						{#if tab.label === 'Queue' && data.pendingCount > 0}
							<span
								class="min-w-6 rounded-full bg-marker px-1.5 text-center text-[13px] leading-6 text-on-marker tabular-nums"
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
