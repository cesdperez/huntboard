<script lang="ts">
	import type { GameRow, TeamWithClaimCount } from '#lib/server/db/types.js';

	let { game, teams }: { game: GameRow; teams: TeamWithClaimCount[] } = $props();
</script>

<section aria-labelledby="teams-heading" class="flex flex-col gap-3">
	<h2 id="teams-heading" class="type-heading">Teams</h2>
	<p class="type-secondary">{teams.length} teams in {game.name}.</p>
</section>
