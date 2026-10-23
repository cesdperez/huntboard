<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { COUNT_UP_MS, motionMs } from '#lib/client/score-motion.js';
	import Points from './points.svelte';

	type Props = { value: number; class?: string };

	let { value, class: className }: Props = $props();

	// Starts at the value it mounts with, so a page load shows totals at once and only changes count.
	const shown = new Tween(
		untrack(() => value),
		{ easing: cubicOut }
	);

	$effect(() => {
		void shown.set(value, { duration: motionMs(COUNT_UP_MS) });
	});
</script>

<!-- Screen readers get the final total, not every step of the count. -->
<Points value={Math.round(shown.current)} variant="total" class={className} aria-hidden="true" />
<span class="sr-only">{value}</span>
