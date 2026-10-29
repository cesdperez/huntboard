<script lang="ts">
	import ClaimSection from '#lib/components/setup/claim-section.svelte';
	import ChallengesSection from '#lib/components/setup/challenges-section.svelte';
	import GameImageSection from '#lib/components/setup/game-image-section.svelte';
	import GameSettingsSection from '#lib/components/setup/game-settings-section.svelte';
	import LinksSection from '#lib/components/setup/links-section.svelte';
	import ResetSection from '#lib/components/setup/reset-section.svelte';
	import TeamsSection from '#lib/components/setup/teams-section.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="type-title">Setup</h1>

<div class="mt-6 flex flex-col gap-10">
	{#if data.claim}
		<ClaimSection claim={data.claim} />
	{/if}
	<GameSettingsSection game={data.game} />
	<GameImageSection game={data.game} />
	<TeamsSection game={data.game} teams={data.teams} />
	<ChallengesSection game={data.game} challenges={data.challenges} />
	<LinksSection game={data.game} teams={data.teams} />
	<ResetSection game={data.game} />
</div>
