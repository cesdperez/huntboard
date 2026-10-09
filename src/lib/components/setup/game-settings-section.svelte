<script lang="ts">
	import type { GameRow } from '#lib/server/db/types.js';

	let { game }: { game: GameRow } = $props();
</script>

<section aria-labelledby="game-settings-heading" class="flex flex-col gap-3">
	<h2 id="game-settings-heading" class="type-heading">Game</h2>
	<p class="type-secondary">Name, start and end time, and late penalty for {game.name}.</p>
</section>
