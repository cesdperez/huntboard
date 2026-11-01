<script lang="ts">
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import type { GameClock } from '#lib/client/game-clock.svelte.js';
	import HowToPlay from './how-to-play.svelte';

	let { open, clock, onclose }: { open: boolean; clock: GameClock; onclose: () => void } = $props();
</script>

<Sheet.Root {open} onOpenChange={(isOpen) => !isOpen && onclose()}>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>How to play</Sheet.Title>
		</Sheet.Header>
		<HowToPlay {clock} />
	</Sheet.Content>
</Sheet.Root>
