<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { OfflineNotice, refreshGameData } from '#lib/components/connection/index.js';
	import { GameImageHeader, TeamAvatar } from '#lib/components/images/index.js';
	import { CountingPoints } from '#lib/components/points/index.js';
	import { GameClock } from '#lib/game-clock.svelte.js';
	import { startPolling } from '#lib/live-updates.js';
	import { ordinal } from '#lib/ordinal.js';
	import { REORDER_MS, motionMs } from '#lib/score-motion.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = new GameClock(() => data.game);
	// Initials appear only once some team has a picture, so a game without pictures looks as before.
	const showAvatars = $derived(data.standings.some((row) => row.avatarKey));

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

<main
	class="scoreboard mx-auto flex min-h-dvh max-w-content flex-col px-gutter py-6"
	style:--teams={Math.max(data.standings.length, 3)}
>
	<header class="flex flex-col gap-1">
		<h1 class="scoreboard-title type-title">{data.game.name}</h1>
		<p class="scoreboard-status type-secondary tabular-nums">{clock.countdown ?? ' '}</p>
		<OfflineNotice />
		{#if data.game.image}
			<GameImageHeader image={data.game.image} class="scoreboard-image mt-2" />
		{/if}
	</header>

	{#if data.standings.length === 0}
		<p class="mt-6 type-secondary">No teams yet. They show up here once the organiser adds them.</p>
	{:else}
		<ol class="mt-4 flex flex-col border-t" aria-label="Scoreboard">
			{#each data.standings as row, index (row.teamId)}
				<!-- Higher ranks paint on top, so a climbing team slides over the rows it passes. -->
				<li
					class="scoreboard-row relative flex min-h-row items-center gap-3 border-b bg-paper py-2"
					animate:flip={{ duration: motionMs(REORDER_MS) }}
					style:z-index={data.standings.length - index}
				>
					<span class="scoreboard-rank w-16 shrink-0 type-score text-[28px]"
						>{ordinal(row.rank)}</span
					>
					{#if showAvatars}
						<TeamAvatar
							name={row.name}
							avatarKey={row.avatarKey}
							class="scoreboard-avatar size-10 text-[17px]"
						/>
					{/if}
					<span class="min-w-0 flex-1">
						<span class="scoreboard-name block truncate">{row.name}</span>
						{#if row.members}<span class="scoreboard-members block type-secondary"
								>{row.members}</span
							>{/if}
					</span>
					<CountingPoints value={row.total} class="scoreboard-total" />
				</li>
			{/each}
		</ol>
	{/if}
</main>

<style>
	/* The big-screen view for the final reveal: same page, the list fills the height and centres. */
	@media (min-width: 1024px) {
		.scoreboard {
			--score-size: clamp(40px, calc(55dvh / var(--teams)), 8vw);
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
	}
</style>
