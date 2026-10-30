<script lang="ts">
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { ClaimMediaView } from '#lib/components/media/index.js';
	import type { QueueClaim } from '#lib/server/pages/judging-pages.js';
	import { earlierRejectionsText } from '#lib/format/earlier-rejections.js';
	import { timeAgo } from '#lib/format/time-ago.js';
	import JudgePanel from './judge-panel.svelte';

	type Props = {
		claim: QueueClaim;
		/** Takes focus when a judged item leaves its place. */
		id: string;
		/** False once a refresh shows the claim is no longer pending, kept in view for its notice. */
		live: boolean;
		notice: string | null;
		/** Null until the browser clock runs. */
		now: Date | null;
		onfailure: (message: string) => void;
		ondone: () => void;
		ondismiss: () => void;
	};

	let { claim, id, live, notice, now, onfailure, ondone, ondismiss }: Props = $props();

	const label = $derived(`${claim.team_name}, ${claim.challenge_title}`);
</script>

<li {id} tabindex="-1" class="flex flex-col gap-3 border-b py-4" aria-label={label}>
	<div class="flex flex-col gap-1">
		<p class="type-secondary">
			<bdi class="font-semibold text-ink">{claim.team_name}</bdi>{now
				? `, ${timeAgo(claim.marked_at, now)}`
				: ''}
		</p>
		<p class="flex items-baseline justify-between gap-3">
			<span class="min-w-0 break-words">{claim.challenge_title}</span>
			<Points min={claim.min_points} max={claim.max_points} />
		</p>
		<p class="type-secondary break-words">
			{#if claim.note}“<bdi>{claim.note}</bdi>” marked by <bdi>{claim.marked_by}</bdi>{:else}Marked
				by
				<bdi>{claim.marked_by}</bdi>{/if}
		</p>
		{#if claim.rejected_count > 0}
			<p class="type-secondary text-danger!">
				{earlierRejectionsText({
					count: claim.rejected_count,
					lastNote: claim.last_rejection_note
				})}
			</p>
		{/if}
	</div>

	{#if claim.media}
		<ClaimMediaView media={claim.media} {label} preload="none" />
	{/if}

	{#if live}
		<JudgePanel
			target={{ claimId: claim.id, from: 'pending' }}
			min={claim.min_points}
			max={claim.max_points}
			{label}
			{onfailure}
			{ondone}
		/>
		{#if notice}
			<p class="text-[15px] text-danger" role="alert">{notice}</p>
		{/if}
	{:else}
		<div class="flex items-center gap-3">
			<p class="min-w-0 flex-1 font-semibold" role="alert">{notice}</p>
			<Button onclick={ondismiss}>OK</Button>
		</div>
	{/if}
</li>
