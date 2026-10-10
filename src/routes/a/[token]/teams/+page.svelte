<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import { formatClockTime } from '#lib/clock-time.js';
	import TeamScoresItem from '#lib/components/admin/team-scores-item.svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { startPolling } from '#lib/live-updates.js';
	import { plural } from '#lib/plural.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	onMount(() => startPolling(refreshGameData));

	const penaltyLine = $derived.by(() => {
		const { endsAt, latePenaltyPerMinute } = data.game;
		if (!endsAt) return 'The game has no end time yet, so no one is late.';
		if (latePenaltyPerMinute === 0) return 'Arriving late costs nothing in this game.';

		const end = browser ? ` after ${formatClockTime(endsAt, new Date())}` : '';
		return `Each whole minute${end} costs ${plural(latePenaltyPerMinute, 'point')}.`;
	});
</script>

<h1 class="type-title">Teams</h1>
<p class="mt-1 type-secondary">{penaltyLine}</p>

{#if data.teams.length === 0}
	<p class="mt-6 type-secondary">No teams yet. Add them in Setup.</p>
{:else}
	<ol class="mt-4 flex flex-col border-t" aria-label="Teams">
		{#each data.teams as team (team.id)}
			<TeamScoresItem
				{team}
				endsAt={data.game.endsAt}
				latePenaltyPerMinute={data.game.latePenaltyPerMinute}
			/>
		{/each}
	</ol>
{/if}
