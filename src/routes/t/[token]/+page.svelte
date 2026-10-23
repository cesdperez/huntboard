<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { AppBar, EventBanner } from '#lib/components/event/index.js';
	import { GameImageHeader } from '#lib/components/images/index.js';
	import { NicknameButton, NicknamePrompt } from '#lib/components/nickname/index.js';
	import AvatarForm from '#lib/components/team/avatar-form.svelte';
	import ChallengeRow from '#lib/components/team/challenge-row.svelte';
	import ChallengeSheet from '#lib/components/team/challenge-sheet.svelte';
	import RenameSheet from '#lib/components/team/rename-sheet.svelte';
	import SectionHeading from '#lib/components/team/section-heading.svelte';
	import TeamStrip from '#lib/components/team/team-strip.svelte';
	import { Toast } from '#lib/components/toast/index.js';
	import { GameClock } from '#lib/client/game-clock.svelte.js';
	import { groupBySection } from '#lib/format/group-by-section.js';
	import { startPolling } from '#lib/client/live-updates.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = new GameClock(() => data.game);
	const event = $derived(pageLayout() === 'event');

	// The id outlives the open flag, so the sheet keeps its content while it slides away.
	let selectedId = $state<number | null>(null);
	let sheetOpen = $state(false);
	let renaming = $state(false);
	const selected = $derived(data.challenges.find((c) => c.id === selectedId) ?? null);

	onMount(() => {
		const stopClock = clock.start();
		const stopPolling = startPolling(refreshGameData);
		return () => {
			stopClock();
			stopPolling();
		};
	});

	function select(id: number) {
		selectedId = id;
		sheetOpen = true;
	}
</script>

<svelte:head>
	<title>{data.team.name} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-dvh">
	{#if event}
		<AppBar><NicknameButton /></AppBar>
		<EventBanner
			name={data.game.name}
			day={clock.startDay}
			countdown={clock.countdown}
			image={data.game.image}
		/>
	{:else}
		<div class="mx-auto flex max-w-content items-center justify-between gap-3 px-gutter pt-2">
			<p class="truncate type-secondary">{data.game.name}</p>
			<NicknameButton />
		</div>
		{#if data.game.image}
			<div class="mx-auto max-w-content px-gutter pb-2">
				<GameImageHeader image={data.game.image} />
			</div>
		{/if}
	{/if}

	<TeamStrip
		teamName={data.team.name}
		members={data.team.members}
		standings={data.standings}
		countdown={clock.countdown}
		onrename={() => (renaming = true)}
	>
		<AvatarForm hasAvatar={data.team.avatarKey !== null} {clock} />
	</TeamStrip>

	<main class="mx-auto max-w-content px-gutter pt-2 pb-24">
		<h1 class="sr-only">{data.team.name} challenges</h1>
		{#if data.challenges.length === 0}
			<p class="py-6 type-secondary">Challenges show up here once the game is ready.</p>
		{:else}
			{#each groupBySection(data.challenges) as group, groupIndex (groupIndex)}
				<section class="flex flex-col">
					{#if group.section}
						<SectionHeading section={group.section} />
					{/if}
					<ul class={['flex flex-col', !event && 'border-t']}>
						{#each group.items as challenge (challenge.id)}
							<ChallengeRow {challenge} onselect={() => select(challenge.id)} />
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</main>
</div>

<ChallengeSheet challenge={selected} open={sheetOpen} {clock} onclose={() => (sheetOpen = false)} />
<RenameSheet
	open={renaming}
	name={data.team.name}
	members={data.team.members}
	{clock}
	onclose={() => (renaming = false)}
/>
<NicknamePrompt />
<Toast />
