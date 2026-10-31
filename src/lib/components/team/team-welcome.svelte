<script lang="ts">
	import { onMount } from 'svelte';
	import { dismissTeamWelcome, teamWelcomeDismissed } from '#lib/client/team-welcome.js';
	import { nickname } from '#lib/components/nickname/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let {
		teamToken,
		teamName,
		gameName,
		ondismiss
	}: { teamToken: string; teamName: string; gameName: string; ondismiss: () => void } = $props();

	// Hidden until the browser has read the dismissal, so the server never renders it.
	let dismissed = $state(true);
	onMount(() => {
		dismissed = teamWelcomeDismissed(teamToken);
	});

	// After the nickname prompt, so a player meets one thing at a time.
	const shown = $derived(!dismissed && nickname.loaded && !nickname.promptOpen);

	function dismiss() {
		dismissTeamWelcome(teamToken);
		dismissed = true;
		ondismiss();
	}
</script>

{#if shown}
	<section
		aria-labelledby="team-welcome-heading"
		class="mb-4 flex flex-col gap-3 rounded-control border-2 border-line bg-surface p-4 text-ink"
	>
		<h2 id="team-welcome-heading" class="text-[17px] leading-snug">
			You are on <b class="font-semibold"><bdi>{teamName}</bdi></b> in
			<b class="font-semibold"><bdi>{gameName}</bdi></b>.
		</h2>
		<ul class="flex list-disc flex-col gap-1 pl-5 type-secondary">
			<li>Tap a challenge to open it.</li>
			<li>Tap "Mark done" once your team has done it. Add a photo or video if you have one.</li>
			<li>A judge scores it. Your rank and total show at the top.</li>
		</ul>
		<Button class="self-start" onclick={dismiss}>Hide</Button>
	</section>
{/if}
