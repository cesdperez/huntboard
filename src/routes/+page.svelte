<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { resolve } from '$app/paths';
	import { AppBar } from '#lib/components/event/index.js';
	import { Marker } from '#lib/components/marker/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	// The example claim the hero judges once, so the leaderboard shows what a scored claim does.
	const CLAIM = {
		team: 'Lost & Found',
		challenge: 'Find the oldest door on the street',
		points: 40
	};
	const JUDGE_DELAY_MS = 1600;

	let scored = $state(false);
	const claimTotal = new Tween(210, { duration: 700 });

	const teams = $derived(
		[
			{ name: 'Harbour Gulls', total: 240 },
			{ name: 'Night Owls', total: 225 },
			{ name: CLAIM.team, total: scored ? 210 + CLAIM.points : 210 },
			{ name: 'The Detours', total: 180 }
		].sort((a, b) => b.total - a.total)
	);

	onMount(() => {
		const timer = setTimeout(() => {
			scored = true;
			claimTotal.set(210 + CLAIM.points, { duration: prefersReducedMotion.current ? 0 : 700 });
		}, JUDGE_DELAY_MS);
		return () => clearTimeout(timer);
	});

	const steps = [
		{
			symbol: 'start',
			title: 'Write your challenges',
			text: 'Paste a list with a points range for each one. Set the start and end time, and a late penalty if you want one.'
		},
		{
			symbol: 1,
			title: 'Send each team its link',
			text: 'Players need no account. Each team gets a private link and a QR code, picks a nickname and starts.'
		},
		{
			symbol: 2,
			title: 'Judge claims as they arrive',
			text: 'Teams mark a challenge done and can attach a photo or video. You score it inside its range or reject it with a reason.'
		},
		{
			symbol: 'finish',
			title: 'Show the scoreboard',
			text: 'Put it on a big screen at the finish. Totals change as you judge, and a QR code lets everyone follow on their phone.'
		}
	] as const;

	const facts = [
		{
			title: 'Made for one hand, outdoors',
			text: 'Every screen fits a phone first, with big touch targets and a dark mode for the evening.'
		},
		{
			title: 'Links, not accounts',
			text: 'Only the organiser signs in. A leaked link can be replaced from Setup, and the old one stops working at once.'
		},
		{
			title: 'Fair to every team',
			text: 'Teams see their own claims and the totals of the others, never what the others found.'
		},
		{
			title: 'Proof next to the claim',
			text: 'Photos and videos arrive with the claim, shrunk on the phone so they upload fast on mobile data.'
		}
	];
</script>

<svelte:head>
	<title>Huntboard: a live scoreboard for team scavenger hunts</title>
	<meta
		name="description"
		content="Run a scavenger hunt from your phone. Teams claim challenges with photos and videos, you judge them, and everyone follows one live leaderboard."
	/>
</svelte:head>

{#snippet contours(className: string)}
	<svg class={className} viewBox="0 0 400 400" fill="none" aria-hidden="true">
		<g class="contour-lines" stroke-width="1.5">
			<path d="M206 18C305 22 384 98 382 196S318 380 204 384 18 318 16 206 107 14 206 18Z" />
			<path d="M208 52C285 56 348 116 346 196S292 346 204 350 52 296 51 207 131 48 208 52Z" />
			<path d="M210 88C266 91 312 136 310 196S270 312 205 315 88 274 87 208 154 85 210 88Z" />
			<path d="M212 124C248 126 276 156 275 197S248 278 206 280 122 254 122 209 176 122 212 124Z" />
			<path d="M214 160C232 161 242 178 241 198S230 244 208 245 156 232 156 210 196 159 214 160Z" />
		</g>
	</svg>
{/snippet}

{#snippet courseSymbol(symbol: 'start' | 'finish' | number)}
	<svg class="course-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true">
		{#if symbol === 'start'}
			<path d="M24 7L43 40H5Z" />
		{:else if symbol === 'finish'}
			<circle cx="24" cy="24" r="19" />
			<circle cx="24" cy="24" r="12" />
		{:else}
			<circle cx="24" cy="24" r="17" />
		{/if}
	</svg>
{/snippet}

<header>
	<AppBar class="max-w-[1120px]! lg:px-10!">
		<a
			href={resolve('/games')}
			class="inline-flex min-h-touch items-center text-[17px] font-semibold underline-offset-4 hover:underline"
			>Sign in</a
		>
	</AppBar>
</header>

<main>
	<section class="hero surface-banner">
		<div class="wide grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20">
			<div>
				<h1 class="hero-title type-banner">Run a scavenger hunt with a live scoreboard</h1>
				<p class="mt-6 max-w-[34ch] text-[19px] leading-normal font-medium lg:text-[21px]">
					Teams claim challenges from their phones. You judge each claim with its photo or video.
					Everyone follows the same leaderboard as it changes.
				</p>
				<div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
					<Button href={resolve('/new')} variant="primary" size="lg">Create a hunt</Button>
					<a
						href={resolve('/games')}
						class="inline-flex min-h-touch items-center font-semibold underline underline-offset-4"
						>Open my hunts</a
					>
				</div>
				<p class="mt-8 max-w-[40ch] text-[15px] leading-snug">
					Playing in a hunt? Open the team link your organiser sent you. There is nothing to
					install.
				</p>
			</div>

			<figure class="demo">
				{@render contours('demo-contours')}
				<div class="demo-board" aria-hidden="true">
					<div class="flex items-center gap-3 border-b-2 border-line px-4 py-3">
						<Marker state={scored ? 'scored' : 'pending'} points={CLAIM.points} />
						<div class="min-w-0 flex-1">
							<p class="truncate text-[15px] leading-tight font-semibold">{CLAIM.challenge}</p>
							<p class="type-secondary">
								{CLAIM.team}, {scored ? `scored ${CLAIM.points} points` : 'waiting for a judge'}
							</p>
						</div>
					</div>
					<p class="px-4 pt-4 pb-1 font-display text-[17px] font-bold">Leaderboard</p>
					<ol class="px-2 pb-2">
						{#each teams as team, index (team.name)}
							<li
								class="demo-row"
								data-own={team.name === CLAIM.team || undefined}
								animate:flip={{ duration: prefersReducedMotion.current ? 0 : 600 }}
							>
								<span class="w-8 font-display text-[20px] font-extrabold tabular-nums"
									>{index + 1}</span
								>
								<span class="flex-1 truncate font-semibold">{team.name}</span>
								<span class="demo-total"
									>{team.name === CLAIM.team ? Math.round(claimTotal.current) : team.total}</span
								>
							</li>
						{/each}
					</ol>
				</div>
				<figcaption class="demo-caption mt-3 text-center text-[15px] leading-snug">
					A judge scores a claim, and the team climbs the leaderboard.
				</figcaption>
			</figure>
		</div>
	</section>

	<section class="wide py-14 lg:py-24" aria-labelledby="course-heading">
		<h2 id="course-heading" class="section-title">How a hunt runs</h2>
		<p class="mt-3 max-w-[52ch] type-secondary text-[17px]">
			Like an orienteering course: a start, the checkpoints in between, and a finish where the
			scores are read out.
		</p>
		<ol class="course mt-10 lg:mt-14">
			{#each steps as step (step.title)}
				<li class="course-step">
					<div class="course-mark">
						{@render courseSymbol(step.symbol)}
						{#if typeof step.symbol === 'number'}
							<span class="course-number">{step.symbol}</span>
						{/if}
					</div>
					<div>
						<h3 class="type-heading text-[19px]">{step.title}</h3>
						<p class="mt-2 max-w-[38ch] type-secondary text-[16px]">{step.text}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section class="border-t-2 border-line bg-surface" aria-labelledby="facts-heading">
		<div class="wide grid gap-10 py-14 lg:grid-cols-[1fr_2fr] lg:py-24">
			<h2 id="facts-heading" class="section-title max-w-[14ch]">Built for streets, not offices</h2>
			<dl class="grid gap-x-12 gap-y-8 sm:grid-cols-2">
				{#each facts as fact (fact.title)}
					<div class="border-t-2 border-ink pt-4">
						<dt class="type-heading text-[19px]">{fact.title}</dt>
						<dd class="mt-2 type-secondary text-[16px]">{fact.text}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>

	<section class="surface-app-bar" aria-labelledby="start-heading">
		<div
			class="wide flex flex-col gap-6 py-14 lg:flex-row lg:items-end lg:justify-between lg:py-20"
		>
			<div>
				<h2 id="start-heading" class="closing-title type-banner">Set the course tonight</h2>
				<p class="mt-4 max-w-[44ch] text-[17px] leading-normal">
					Sign in with your email, name the game and paste your challenges. Teams can start as soon
					as they have their links.
				</p>
			</div>
			<Button href={resolve('/new')} variant="primary" size="lg" class="self-start lg:self-end"
				>Create a hunt</Button
			>
		</div>
	</section>
</main>

<style>
	.wide {
		margin-inline: auto;
		max-width: 1120px;
		padding-inline: var(--spacing-gutter);
	}

	@media (width >= 64rem) {
		.wide {
			padding-inline: 40px;
		}
	}

	.hero {
		overflow: hidden;
	}

	.hero-title {
		font-size: clamp(56px, 15vw, 104px);
		line-height: 0.88;
		max-width: 12ch;
		text-wrap: balance;
	}

	.demo {
		position: relative;
		margin: 0;
		padding-block: 24px;
	}

	/* The map behind the example board, never behind its text: the board is opaque. */
	.demo :global(.demo-contours) {
		position: absolute;
		inset: -8px -40px;
		width: calc(100% + 80px);
		height: calc(100% + 16px);
		pointer-events: none;
	}

	@media (width >= 64rem) {
		.demo :global(.demo-contours) {
			inset: -120px -160px;
			width: calc(100% + 320px);
			height: calc(100% + 240px);
		}
	}

	/* Lifts the caption off the contour lines that pass under it. */
	.demo-caption {
		position: relative;
		width: fit-content;
		margin-inline: auto;
		padding-inline: 8px;
		background: var(--banner);
	}

	.demo :global(.contour-lines) {
		/* --waiting is each theme's warm secondary colour, the contour brown in Contour. */
		stroke: color-mix(in oklab, var(--waiting) 45%, transparent);
	}

	.demo-board {
		position: relative;
		max-width: 420px;
		margin-inline: auto;
		border: 2px solid var(--ink);
		border-radius: var(--radius-xl);
		background: var(--surface);
		color: var(--ink);
		box-shadow: 8px 8px 0 var(--marker);
		overflow: hidden;
	}

	.demo-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 52px;
		padding: 0 12px 0 10px;
		border-left: 4px solid transparent;
		border-radius: var(--radius-sm);
	}

	.demo-row[data-own] {
		border-left-color: var(--own);
		background: var(--own-row);
	}

	.demo-total {
		font-family: var(--font-score);
		font-size: 30px;
		line-height: 1;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--score);
	}

	.section-title {
		font-family: var(--font-display);
		font-size: clamp(30px, 5vw, 44px);
		line-height: 1.1;
		font-weight: 700;
		font-stretch: var(--stretch-display);
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.closing-title {
		font-size: clamp(48px, 10vw, 84px);
		line-height: 0.9;
	}

	/* The course line runs through every symbol, down on a phone and across on a wide screen. */
	.course {
		display: grid;
		gap: 36px;
	}

	.course-step:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 48px;
		bottom: -36px;
		left: 23px;
		border-left: 2.5px solid var(--marker);
	}

	.course-step {
		position: relative;
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}

	.course-mark {
		position: relative;
		width: 48px;
		height: 48px;
		background: var(--paper);
	}

	.course-symbol {
		width: 48px;
		height: 48px;
		stroke: var(--marker);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}

	/* Orienteering prints a control's number beside its circle. */
	.course-number {
		position: absolute;
		top: -6px;
		right: -10px;
		font-family: var(--font-score);
		font-size: 22px;
		line-height: 1;
		font-weight: 800;
		color: var(--marker);
	}

	@media (width >= 64rem) {
		.course {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 32px;
		}

		.course-step:not(:last-child)::before {
			top: 23px;
			bottom: auto;
			left: 48px;
			right: -32px;
			border-left: 0;
			border-top: 2.5px solid var(--marker);
		}

		.course-step {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}
	}
</style>
