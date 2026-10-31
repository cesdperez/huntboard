<script lang="ts">
	import { page } from '$app/state';
	import { gameLinks } from '#lib/client/game-links.js';
	import { formatJoinCode, joinCodeOf } from '#lib/domain/join-code.js';

	let { token }: { token: string } = $props();

	const code = $derived(formatJoinCode(joinCodeOf(token)));
	const joinPage = $derived(gameLinks(page.url.href).joinPage);
</script>

<p class="type-secondary">
	Join code
	<span class="ml-1 font-score text-[22px] font-extrabold tracking-wider text-ink select-all"
		>{code}</span
	>. Without the link, players type it at {joinPage}.
</p>
