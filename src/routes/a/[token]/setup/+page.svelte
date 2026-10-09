<script lang="ts">
	import ChallengesSection from '#lib/components/setup/challenges-section.svelte';
	import GameSettingsSection from '#lib/components/setup/game-settings-section.svelte';
	import LinksSection from '#lib/components/setup/links-section.svelte';
	import TeamsSection from '#lib/components/setup/teams-section.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="type-title">Setup</h1>

<div class="mt-6 flex flex-col gap-10">
	<GameSettingsSection game={data.game} />
	<TeamsSection game={data.game} teams={data.teams} />
	<ChallengesSection game={data.game} challenges={data.challenges} />
	<LinksSection game={data.game} teams={data.teams} />
</div>
