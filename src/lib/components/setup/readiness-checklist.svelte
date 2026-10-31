<script lang="ts">
	import CircleIcon from '@lucide/svelte/icons/circle';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { resolve } from '$app/paths';
	import { getGameClock } from '#lib/client/game-clock.svelte.js';
	import { gameReadiness, gameStateLine, type ReadinessCheck } from '#lib/domain/game-readiness.js';
	import type { GameRow } from '#lib/server/db/types.js';

	let {
		game,
		teamCount,
		challengeCount
	}: { game: GameRow; teamCount: number; challengeCount: number } = $props();

	const clock = getGameClock();

	const readiness = $derived(
		gameReadiness(
			{ startsAt: game.starts_at, endsAt: game.ends_at },
			{ challenges: challengeCount, teams: teamCount }
		)
	);

	const SECTIONS: Record<ReadinessCheck['key'], string> = {
		times: 'game-settings-heading',
		challenges: 'challenges-heading',
		teams: 'teams-heading'
	};

	const share = $derived(resolve('/a/[token]/share', { token: game.admin_token }));
	const setup = $derived(resolve('/a/[token]/setup', { token: game.admin_token }));
</script>

<section
	aria-labelledby="readiness-heading"
	class="flex flex-col gap-3 rounded-control border-2 border-line p-4"
>
	<div class="flex flex-col gap-1">
		<h2 id="readiness-heading" class="font-display type-heading">
			{readiness.ready ? 'The game is ready' : 'Get the game ready'}
		</h2>
		{#if clock.phase && clock.countdown}
			<p class="type-secondary tabular-nums">
				{gameStateLine(clock.phase, clock.countdown)}
			</p>
		{/if}
	</div>

	<ul class="flex flex-col gap-2">
		{#each readiness.checks as check (check.key)}
			<li class="flex min-h-touch items-center gap-3">
				{#if check.met}
					<CircleCheckIcon aria-hidden="true" class="size-5 shrink-0 text-ink" />
					<span><span class="sr-only">Done: </span>{check.label}</span>
				{:else}
					<CircleIcon aria-hidden="true" class="size-5 shrink-0 text-muted" />
					<a
						href="{setup}#{SECTIONS[check.key]}"
						class="font-semibold text-ink underline underline-offset-2"
					>
						{check.label}
					</a>
				{/if}
			</li>
		{/each}
		<li class="flex min-h-touch items-center gap-3">
			<ArrowRightIcon aria-hidden="true" class="size-5 shrink-0 text-muted" />
			<a href={share} class="font-semibold text-ink underline underline-offset-2">
				Share the links
			</a>
		</li>
	</ul>

	{#if readiness.ready}
		<p class="type-secondary">Send each team its link or print their QR codes from Share.</p>
	{/if}
</section>
