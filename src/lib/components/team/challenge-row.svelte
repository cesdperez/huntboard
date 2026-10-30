<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Marker } from '#lib/components/marker/index.js';
	import { MediaThumb } from '#lib/components/media/index.js';
	import { Points } from '#lib/components/points/index.js';
	import { rejectedRowLine } from '#lib/domain/claim-messages.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';
	import { pageLayout } from '#lib/themes/page-layout.js';

	type Props = { challenge: TeamChallenge; claimsOpen: boolean; onselect: () => void };

	let { challenge, claimsOpen, onselect }: Props = $props();

	const claim = $derived(challenge.claim);
	const event = $derived(pageLayout() === 'event');
</script>

<li class={event ? 'border-b last:border-b-0' : 'border-b'}>
	<button
		type="button"
		class="flex min-h-row w-full items-center gap-3 py-3 text-left"
		onclick={onselect}
	>
		<Marker state={claim?.status ?? 'open'} points={claim?.points ?? undefined} />
		<span class="flex min-w-0 flex-1 flex-col">
			<span class={['break-words', event && 'leading-snug font-semibold']}>{challenge.title}</span>
			{#if event && challenge.description}
				<span class="line-clamp-2 type-secondary leading-snug">{challenge.description}</span>
			{/if}
			{#if claim?.status === 'pending'}
				<span class="type-secondary text-waiting!">Waiting for a judge</span>
			{:else if claim?.status === 'rejected'}
				<span class="type-secondary text-danger!">
					{rejectedRowLine(claim.judgeNote, claimsOpen)}
				</span>
			{/if}
		</span>
		{#if claim?.media}
			<MediaThumb kind={claim.media.kind} src={claim.media.src} class="size-8" />
		{/if}
		{#if event}
			<span class="flex min-w-18 shrink-0 flex-col items-end">
				<Points
					class="text-[17px] leading-tight"
					min={challenge.minPoints}
					max={challenge.maxPoints}
				/>
				<span aria-hidden="true" class="text-[15px] leading-tight text-muted">points</span>
			</span>
			<ChevronRightIcon aria-hidden="true" class="-mr-1 size-5 shrink-0 text-muted" />
		{:else}
			<Points min={challenge.minPoints} max={challenge.maxPoints} />
		{/if}
	</button>
</li>
