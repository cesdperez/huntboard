<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { OfflineNotice, refreshGameData } from '#lib/components/connection/index.js';
	import { CountingPoints } from '#lib/components/points/index.js';
	import { GameClock } from '#lib/game-clock.svelte.js';
	import { startPolling } from '#lib/live-updates.js';
	import { ordinal } from '#lib/ordinal.js';
	import { REORDER_MS, motionMs } from '#lib/score-motion.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = new GameClock(() => data.game);

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
	</header>

	{#if data.standings.length === 0}
		<p class="mt-6 type-secondary">No teams yet. They show up here once the organiser adds them.</p>
	{:else}
		<ol class="mt-4 flex flex-col border-t" aria-label="Scoreboard">
			{#each data.standings as row (row.teamId)}
				<li
					class="scoreboard-row relative flex min-h-row items-center gap-3 border-b bg-paper py-2"
					animate:flip={{ duration: motionMs(REORDER_MS) }}
				>
					<span class="scoreboard-rank w-16 shrink-0 type-score text-[28px]"
						>{ordinal(row.rank)}</span
					>
					<span class="scoreboard-name min-w-0 flex-1 truncate">{row.name}</span>
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

		.scoreboard-name {
			font-size: calc(var(--score-size) * 0.45);
			font-weight: 600;
		}

		.scoreboard :global(.scoreboard-total) {
			font-size: var(--score-size);
		}
	}
</style>
