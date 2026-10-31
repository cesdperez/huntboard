<script lang="ts">
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { onMount, tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { AppBar, EventBanner } from '#lib/components/event/index.js';
	import { GameImageHeader } from '#lib/components/images/index.js';
	import { NicknameButton, NicknamePrompt, nickname } from '#lib/components/nickname/index.js';
	import AvatarForm from '#lib/components/team/avatar-form.svelte';
	import ChallengeRow from '#lib/components/team/challenge-row.svelte';
	import ChallengeSheet from '#lib/components/team/challenge-sheet.svelte';
	import HowToPlaySheet from '#lib/components/team/how-to-play-sheet.svelte';
	import RenameSheet from '#lib/components/team/rename-sheet.svelte';
	import SectionHeading from '#lib/components/team/section-heading.svelte';
	import TeamStrip from '#lib/components/team/team-strip.svelte';
	import TeamOnboarding from '#lib/components/team/team-onboarding.svelte';
	import { Toast, toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { GameClock } from '#lib/client/game-clock.svelte.js';
	import { judgedClaimMessages } from '#lib/domain/judged-claims.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';
	import { groupBySection } from '#lib/format/group-by-section.js';
	import { startPolling } from '#lib/client/live-updates.js';
	import { trackRecentGame } from '#lib/client/recent-games.svelte.js';
	import { dismissTeamWelcome, teamWelcomeDismissed } from '#lib/client/team-welcome.js';
	import { pageLayout } from '#lib/themes/page-layout.js';
	import { isolate } from '#lib/format/text.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = new GameClock(() => data.game);
	const event = $derived(pageLayout() === 'event');

	// The id outlives the open flag, so the sheet keeps its content while it slides away.
	let selectedId = $state<number | null>(null);
	let sheetOpen = $state(false);
	let renaming = $state(false);
	let howToPlay = $state(false);
	const selected = $derived(data.challenges.find((c) => c.id === selectedId) ?? null);

	// Null until the first load is shown, so opening the page announces nothing.
	let shownChallenges: TeamChallenge[] | null = null;
	$effect(() => {
		const challenges = data.challenges;
		// Untracked, or the clock's tick would rerun this every second.
		const claimsOpen = untrack(() => clock.closedMessage === null);
		if (shownChallenges) {
			announceJudged(judgedClaimMessages(shownChallenges, challenges, claimsOpen));
		}
		shownChallenges = challenges;
	});

	const token = $derived(page.params.token ?? '');
	let heading = $state<HTMLElement | null>(null);

	// Hidden until the browser has read the dismissal, so the server never renders it.
	let welcomeDismissed = $state(true);
	// A player without a name has nothing to mark claims with, so the welcome returns until one is set.
	const welcoming = $derived(nickname.loaded && (!welcomeDismissed || nickname.value === null));

	trackRecentGame(() => ({
		kind: 'team',
		path: resolve('/t/[token]', { token }),
		gameName: data.game.name,
		teamName: data.team.name
	}));

	onMount(() => {
		welcomeDismissed = teamWelcomeDismissed(token);
		const stopClock = clock.start();
		const stopPolling = startPolling(refreshGameData);
		return () => {
			stopClock();
			stopPolling();
		};
	});

	function announceJudged(messages: string[]) {
		if (messages.length === 0) return;
		toast.queue(...messages);
		navigator.vibrate?.(200);
	}

	async function startPlaying() {
		dismissTeamWelcome(token);
		welcomeDismissed = true;
		await tick();
		heading?.focus();
	}

	function select(id: number) {
		selectedId = id;
		sheetOpen = true;
	}
</script>

<svelte:head>
	<title>{isolate(data.team.name)} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-dvh">
	<header>
		<AppBar>
			<div class="flex min-w-0 items-center">
				<Button
					variant="ghost"
					size="icon"
					aria-label="How to play"
					title="How to play"
					onclick={() => (howToPlay = true)}
				>
					<CircleHelpIcon aria-hidden="true" />
				</Button>
				{#if !welcoming}<NicknameButton />{/if}
			</div>
		</AppBar>
		{#if event}
			<EventBanner
				name={data.game.name}
				day={clock.startDay}
				countdown={clock.countdown}
				image={data.game.image}
			/>
		{:else}
			<p class="mx-auto max-w-content truncate px-gutter pt-2 type-secondary">{data.game.name}</p>
			{#if data.game.image}
				<div class="mx-auto max-w-content px-gutter pb-2">
					<GameImageHeader image={data.game.image} />
				</div>
			{/if}
		{/if}
	</header>

	{#if welcoming}
		<main class="mx-auto max-w-content px-gutter pt-6 pb-24">
			<TeamOnboarding gameName={data.game.name} team={data.team} {clock} onstart={startPlaying} />
		</main>
	{:else}
		<TeamStrip
			teamName={data.team.name}
			members={data.team.members}
			standings={data.standings}
			countdown={clock.countdown}
			onrename={() => (renaming = true)}
		>
			<AvatarForm avatarKey={data.team.avatarKey} {clock} />
		</TeamStrip>

		<main class="mx-auto max-w-content px-gutter pt-2 pb-24">
			<h1 bind:this={heading} tabindex="-1" class="sr-only">{data.team.name} challenges</h1>
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
								<ChallengeRow
									{challenge}
									claimsOpen={clock.closedMessage === null}
									onselect={() => select(challenge.id)}
								/>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</main>
	{/if}
</div>

<ChallengeSheet
	challenge={selected}
	challenges={data.challenges}
	open={sheetOpen}
	{clock}
	onclose={() => (sheetOpen = false)}
/>
<RenameSheet
	open={renaming}
	name={data.team.name}
	members={data.team.members}
	{clock}
	onclose={() => (renaming = false)}
/>
<HowToPlaySheet open={howToPlay} {clock} onclose={() => (howToPlay = false)} />
<NicknamePrompt editOnly />
<Toast />
