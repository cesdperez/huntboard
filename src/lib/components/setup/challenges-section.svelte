<script lang="ts">
	import type { ChallengeWithClaimCount, GameRow } from '#lib/server/db/types.js';
	import ChallengeImport from './challenge-import.svelte';
	import ChallengeList from './challenge-list.svelte';

	let { game, challenges }: { game: GameRow; challenges: ChallengeWithClaimCount[] } = $props();
</script>

<section aria-labelledby="challenges-heading" class="flex flex-col gap-4">
	<h2 id="challenges-heading" class="font-display type-heading">Challenges</h2>

	{#if challenges.length === 0}
		<p class="type-secondary">No challenges in {game.name} yet. Paste your list below.</p>
	{:else}
		<ChallengeList {challenges} />
	{/if}

	<!-- Remounts when the list empties, as after a reset, so the example comes back. -->
	{#key challenges.length === 0}
		<ChallengeImport hasChallenges={challenges.length > 0} />
	{/key}
</section>
