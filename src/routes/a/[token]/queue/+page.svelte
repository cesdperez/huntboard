<script lang="ts">
	import { onMount, tick } from 'svelte';
	import QueueItem from '#lib/components/admin/queue-item.svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { emptyQueueMessage } from '#lib/domain/claim-messages.js';
	import { getGameClock } from '#lib/client/game-clock.svelte.js';
	import { startPolling } from '#lib/client/live-updates.js';
	import { focusIfLost } from '#lib/client/focus.js';
	import { byQueueOrder, takesPlaceOf } from '#lib/components/admin/queue-order.js';
	import type { QueueClaim } from '#lib/server/pages/judging-pages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A claim judged elsewhere drops out of the data, but its notice says who judged it, so it stays until dismissed.
	let notices = $state<Record<number, { claim: QueueClaim; message: string | null }>>({});
	const clock = getGameClock();

	const liveIds = $derived(new Set(data.claims.map((claim) => claim.id)));
	const items = $derived(
		[
			...data.claims,
			...Object.values(notices)
				.map((notice) => notice.claim)
				.filter((claim) => !liveIds.has(claim.id))
		].sort(byQueueOrder)
	);

	let heading = $state<HTMLElement | null>(null);

	onMount(() => startPolling(refreshGameData));

	async function dismiss(claim: QueueClaim) {
		delete notices[claim.id];
		await tick();
		const next = takesPlaceOf(items, claim);
		focusIfLost(next ? document.getElementById(itemId(next)) : heading);
	}

	const itemId = (claim: QueueClaim) => `queue-item-${claim.id}`;
</script>

<div class="flex items-baseline justify-between gap-3">
	<h1 bind:this={heading} tabindex="-1" class="type-title">Queue</h1>
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
				id={itemId(claim)}
				live={liveIds.has(claim.id)}
				notice={notices[claim.id]?.message ?? null}
				now={clock.now}
				onfailure={(message) => (notices[claim.id] = { claim, message })}
				ondone={() => dismiss(claim)}
				ondismiss={() => dismiss(claim)}
			/>
		{/each}
	</ol>
{/if}
