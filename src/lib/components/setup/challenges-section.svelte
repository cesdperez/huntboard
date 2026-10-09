<script lang="ts">
	import type { ChallengeWithClaimCount, GameRow } from '#lib/server/db/types.js';

	let { game, challenges }: { game: GameRow; challenges: ChallengeWithClaimCount[] } = $props();
</script>

<section aria-labelledby="challenges-heading" class="flex flex-col gap-3">
	<h2 id="challenges-heading" class="type-heading">Challenges</h2>
	<p class="type-secondary">{challenges.length} challenges in {game.name}.</p>
</section>
