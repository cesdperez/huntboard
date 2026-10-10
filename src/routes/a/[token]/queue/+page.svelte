<script lang="ts">
	import { onMount } from 'svelte';
	import QueueItem from '#lib/components/admin/queue-item.svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { emptyQueueMessage } from '#lib/domain/claim-messages.js';
	import { GameClock } from '#lib/game-clock.svelte.js';
	import { startPolling } from '#lib/live-updates.js';
	import type { PendingClaimRow } from '#lib/server/db/judging.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A claim judged elsewhere drops out of the data, but its notice says who judged it, so it stays until dismissed.
	let notices = $state<Record<number, { claim: PendingClaimRow; message: string }>>({});
	const clock = new GameClock(() => ({
		startsAt: data.game.starts_at,
		endsAt: data.game.ends_at
	}));

	const liveIds = $derived(new Set(data.claims.map((claim) => claim.id)));
	const items = $derived(
		[
			...data.claims,
			...Object.values(notices)
				.map((notice) => notice.claim)
				.filter((claim) => !liveIds.has(claim.id))
		].sort((a, b) => a.marked_at.localeCompare(b.marked_at) || a.id - b.id)
	);

	onMount(() => {
		const stopClock = clock.start();
		const stopPolling = startPolling(refreshGameData);
		return () => {
			stopClock();
			stopPolling();
		};
	});

	function dismiss(id: number) {
		delete notices[id];
	}
</script>

<div class="flex items-baseline justify-between gap-3">
	<h1 class="type-title">Queue</h1>
	{#if data.claims.length > 0}
		<p class="type-score text-[28px]" aria-label="{data.claims.length} to judge">
			{data.claims.length}
		</p>
	{/if}
</div>

{#if items.length === 0}
	<p class="mt-6 type-secondary">{emptyQueueMessage(clock.phase)}</p>
{:else}
	<ol class="mt-4 flex flex-col border-t" aria-label="Claims to judge, oldest first">
		{#each items as claim (claim.id)}
			<QueueItem
				{claim}
				live={liveIds.has(claim.id)}
				notice={notices[claim.id]?.message ?? null}
				now={clock.now}
				onfailure={(message) => (notices[claim.id] = { claim, message })}
				ondone={() => dismiss(claim.id)}
				ondismiss={() => dismiss(claim.id)}
			/>
		{/each}
	</ol>
{/if}
