<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { OfflineNotice, refreshGameData } from '#lib/components/connection/index.js';
	import { AppBar, EventBanner } from '#lib/components/event/index.js';
	import { GameImageHeader, TeamAvatar } from '#lib/components/images/index.js';
	import { CountingPoints } from '#lib/components/points/index.js';
	import { GameClock } from '#lib/game-clock.svelte.js';
	import { startPolling } from '#lib/live-updates.js';
	import { ordinal } from '#lib/ordinal.js';
	import { REORDER_MS, motionMs } from '#lib/score-motion.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = new GameClock(() => data.game);
	// Initials appear only once some team has a picture, so a game without pictures looks as before.
	const showAvatars = $derived(data.standings.some((row) => row.avatarKey));
	const layout = $derived(pageLayout());

	onMount(() => {
		const stopClock = clock.start();
		const stopPolling = startPolling(refreshGameData);
		return () => {
			stopClock();
			stopPolling();
		};
	});
</script>

<svelte:head>
	<title>{data.game.name} scoreboard · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="scoreboard flex min-h-dvh flex-col"
	data-layout={layout}
	style:--teams={Math.max(data.standings.length, 3)}
>
	{#if layout === 'event'}
		<AppBar class="scoreboard-app-bar" />
		<EventBanner
			heading
			name={data.game.name}
			day={clock.startDay}
			countdown={clock.countdown}
			image={data.game.image}
			class="scoreboard-banner"
		/>
	{/if}
	<main class="scoreboard-main mx-auto flex w-full max-w-content flex-1 flex-col px-gutter py-6">
		{#if layout === 'event'}
			<OfflineNotice class="pb-3" />
			<h2
				class="scoreboard-heading border-b-2 border-score pb-1 font-display text-[32px] leading-tight font-bold"
			>
				Leaderboard
			</h2>
		{:else}
			<header class="flex flex-col gap-1">
				<h1 class="scoreboard-title type-title">{data.game.name}</h1>
				<p class="scoreboard-status type-secondary tabular-nums">{clock.countdown ?? ' '}</p>
				<OfflineNotice />
				{#if data.game.image}
					<GameImageHeader image={data.game.image} class="scoreboard-image mt-2" />
				{/if}
			</header>
		{/if}

		{#if data.standings.length === 0}
			<p class="mt-6 type-secondary">
				No teams yet. They show up here once the organiser adds them.
			</p>
		{:else}
			<ol
				class={['flex flex-col', layout === 'event' ? 'mt-1' : 'mt-4 border-t']}
				aria-label="Scoreboard"
			>
				{#each data.standings as row, index (row.teamId)}
					<!-- Higher ranks paint on top, so a climbing team slides over the rows it passes. -->
					<li
						class={[
							'scoreboard-row relative flex min-h-row items-center gap-3 border-b bg-paper',
							layout === 'event' ? 'py-3' : 'py-2'
						]}
						animate:flip={{ duration: motionMs(REORDER_MS) }}
						style:z-index={data.standings.length - index}
					>
						<span class="scoreboard-rank w-16 shrink-0 type-rank">{ordinal(row.rank)}</span>
						{#if showAvatars}
							<TeamAvatar
								name={row.name}
								avatarKey={row.avatarKey}
								class="scoreboard-avatar {layout === 'event'
									? 'size-12 text-[19px]'
									: 'size-10 text-[17px]'}"
							/>
						{/if}
						<span class="min-w-0 flex-1">
							<span
								class={['scoreboard-name block truncate', layout === 'event' && 'font-semibold']}
								>{row.name}</span
							>
							{#if row.members}<span class="scoreboard-members block type-secondary"
									>{row.members}</span
								>{/if}
						</span>
						{#if layout === 'event'}
							<span class="flex shrink-0 flex-col items-end">
								<CountingPoints value={row.total} class="scoreboard-total" />
								<span aria-hidden="true" class="scoreboard-unit text-[13px] leading-none text-muted"
									>points</span
								>
							</span>
						{:else}
							<CountingPoints value={row.total} class="scoreboard-total" />
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</main>
</div>

<style>
	/* The big-screen view for the final reveal: same page, the list fills the height and centres. */
	@media (min-width: 1024px) {
		.scoreboard {
			--score-size: clamp(40px, calc(var(--score-share) / var(--teams)), 8vw);
			--score-share: 55dvh;
		}

		/* The banner and the points unit under each total take the rest of the height. */
		.scoreboard[data-layout='event'] {
			--score-share: 34dvh;
		}

		.scoreboard-main {
			max-width: none;
			justify-content: center;
			padding-inline: 6vw;
		}

		.scoreboard-title {
			font-size: calc(var(--score-size) * 0.45);
		}

		.scoreboard-status {
			font-size: calc(var(--score-size) * 0.25);
		}

		.scoreboard-heading {
			font-size: calc(var(--score-size) * 0.55);
		}

		.scoreboard-row {
			gap: calc(var(--score-size) * 0.3);
			padding-block: calc(var(--score-size) * 0.12);
		}

		.scoreboard-rank {
			width: calc(var(--score-size) * 1.6);
			font-size: calc(var(--score-size) * 0.6);
		}

		.scoreboard :global(.scoreboard-avatar) {
			width: calc(var(--score-size) * 0.9);
			height: calc(var(--score-size) * 0.9);
			font-size: calc(var(--score-size) * 0.4);
		}

		.scoreboard :global(.scoreboard-image) {
			gap: calc(var(--score-size) * 0.3);
			font-size: calc(var(--score-size) * 0.25);
		}

		.scoreboard :global(.scoreboard-image .game-image-thumb) {
			width: calc(var(--score-size) * 0.7);
			height: calc(var(--score-size) * 0.7);
		}

		.scoreboard :global(.scoreboard-image .game-image-view) {
			font-size: inherit;
		}

		/* The banner follows the screen height, not the total size, so few teams cannot push the list off it. */
		.scoreboard :global(.scoreboard-app-bar) {
			max-width: none;
			padding-inline: 6vw;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-grid) {
			max-width: none;
			padding-inline: 6vw;
			padding-block: 2dvh;
			column-gap: 2dvh;
			row-gap: 1dvh;
			grid-template-columns: minmax(0, 1fr) 9dvh;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-grid[data-image]) {
			grid-template-columns: auto minmax(0, 1fr) 9dvh;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-title) {
			font-size: 8dvh;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-meta) {
			font-size: 2.4dvh;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-icon) {
			width: 1em;
			height: 1em;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-thumb) {
			width: 13dvh;
			height: 17dvh;
		}

		.scoreboard :global(.scoreboard-banner .event-banner-view) {
			justify-self: start;
			min-height: 5dvh;
			font-size: 2.2dvh;
		}

		.scoreboard-name {
			font-size: calc(var(--score-size) * 0.45);
			font-weight: 600;
		}

		.scoreboard-members {
			font-size: calc(var(--score-size) * 0.25);
		}

		.scoreboard :global(.scoreboard-total) {
			font-size: var(--score-size);
		}

		.scoreboard-unit {
			font-size: max(13px, calc(var(--score-size) * 0.22));
		}
	}
</style>
