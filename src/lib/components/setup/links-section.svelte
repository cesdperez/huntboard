<script lang="ts">
	import type { GameRow, TeamWithClaimCount } from '#lib/server/db/types.js';

	let { game, teams }: { game: GameRow; teams: TeamWithClaimCount[] } = $props();
</script>

<section aria-labelledby="links-heading" class="flex flex-col gap-3">
	<h2 id="links-heading" class="type-heading">Links</h2>
	<p class="type-secondary">Admin, scoreboard and {teams.length} team links for {game.name}.</p>
</section>
