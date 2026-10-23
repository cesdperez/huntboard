<script lang="ts">
	import { Marker } from '#lib/components/marker/index.js';
	import { Points } from '#lib/components/points/index.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';

	let { challenge, onselect }: { challenge: TeamChallenge; onselect: () => void } = $props();

	const claim = $derived(challenge.claim);
</script>

<li class="border-b">
	<button
		type="button"
		class="flex min-h-row w-full items-center gap-3 py-3 text-left"
		onclick={onselect}
	>
		<Marker state={claim?.status ?? 'open'} points={claim?.points ?? undefined} />
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="break-words">{challenge.title}</span>
			{#if claim?.status === 'pending'}
				<span class="type-secondary text-waiting!">Waiting for a judge</span>
			{:else if claim?.status === 'rejected'}
				<span class="type-secondary text-danger!">
					{claim.judgeNote
						? `Rejected: ${claim.judgeNote}`
						: 'Rejected. You can mark it done again.'}
				</span>
			{/if}
		</span>
		<Points min={challenge.minPoints} max={challenge.maxPoints} />
	</button>
</li>
