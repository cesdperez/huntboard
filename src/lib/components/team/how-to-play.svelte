<script lang="ts">
	import type { GameClock } from '#lib/client/game-clock.svelte.js';

	let { clock }: { clock: GameClock } = $props();
</script>

<ol class="flex list-decimal flex-col gap-2 pl-5">
	<li>
		Tap a challenge, do it with your team, then tap "Mark done". Add a photo or video as proof.
	</li>
	<li>
		A judge checks it. It shows "Waiting for a judge" until then. Until it is judged, you can still
		edit it (fix the note or swap the photo or video) or undo it if you marked the wrong challenge.
	</li>
	<li>
		<b class="font-semibold">Scored:</b> the points go to your team total at the top.
		<b class="font-semibold">Rejected:</b> you see the judge's reason and can mark it again.
	</li>
</ol>
{#if clock.closedMessage}
	<p class="font-semibold">{clock.closedMessage}</p>
{/if}
