<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import QueueItem from '#lib/components/admin/queue-item.svelte';
	import { GAME_DATA, startPolling } from '#lib/live-updates.js';
	import type { PendingClaimRow } from '#lib/server/db/judging.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A claim judged elsewhere drops out of the data, but its notice says who judged it, so it stays until dismissed.
	let notices = $state<Record<number, { claim: PendingClaimRow; message: string }>>({});
	let nowMs = $state<number | null>(null);

	const liveIds = $derived(new Set(data.claims.map((claim) => claim.id)));
	const items = $derived(
		[
			...data.claims,
			...Object.values(notices)
				.map((notice) => notice.claim)
				.filter((claim) => !liveIds.has(claim.id))
		].sort((a, b) => a.marked_at.localeCompare(b.marked_at) || a.id - b.id)
	);

	const now = $derived(nowMs === null ? null : new Date(nowMs));

	onMount(() => {
		nowMs = Date.now();
		const timer = setInterval(() => (nowMs = Date.now()), 30_000);
		const stopPolling = startPolling(() => invalidate(GAME_DATA));
		return () => {
			clearInterval(timer);
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
	<p class="mt-6 type-secondary">Nothing to judge. New claims show up here.</p>
{:else}
	<ol class="mt-4 flex flex-col border-t" aria-label="Claims to judge, oldest first">
		{#each items as claim (claim.id)}
			<QueueItem
				{claim}
				live={liveIds.has(claim.id)}
				notice={notices[claim.id]?.message ?? null}
				{now}
				onfailure={(message) => (notices[claim.id] = { claim, message })}
				ondone={() => dismiss(claim.id)}
				ondismiss={() => dismiss(claim.id)}
			/>
		{/each}
	</ol>
{/if}
