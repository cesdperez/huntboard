<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { absoluteLink } from '#lib/client/absolute-link.js';
	import { formatJoinCode, joinCodeOf } from '#lib/domain/join-code.js';

	let { token }: { token: string } = $props();

	const code = $derived(formatJoinCode(joinCodeOf(token)));
	// Read out loud, so it names the page without the https:// a player would never say.
	const joinPage = $derived(
		absoluteLink(resolve('/join'), page.url.href).replace(/^https?:\/\//, '')
	);
</script>

<p class="type-secondary">
	Join code
	<span class="ml-1 font-score text-[22px] font-extrabold tracking-wider text-ink select-all"
		>{code}</span
	>. Without the link, players type it at {joinPage}.
</p>
