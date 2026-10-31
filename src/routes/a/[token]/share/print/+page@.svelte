<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { gameLinks } from '#lib/client/game-links.js';
	import { QrCode } from '#lib/components/qr/index.js';
	import { formatJoinCode, joinCodeOf } from '#lib/domain/join-code.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { isolate } from '#lib/format/text.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const links = $derived(gameLinks(page.url.href));

	const cards = $derived([
		...data.teams.map((team) => ({
			key: `team-${team.id}`,
			title: team.name,
			url: links.team(team.token),
			joinCode: formatJoinCode(joinCodeOf(team.token)),
			instruction: 'Scan to join your team. No app or account needed.'
		})),
		{
			key: 'scoreboard',
			title: 'Scoreboard',
			url: links.scoreboard(data.game.scoreboard_token),
			joinCode: null,
			instruction: 'Scan to follow the scores. No app or account needed.'
		}
	]);
</script>

<svelte:head>
	<title>Team QR codes · {isolate(data.game.name)} · Huntboard</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- Black on white in every theme and mode: it goes on paper, and scanners misread low contrast. -->
<div class="min-h-dvh bg-white text-black">
	<header
		class="mx-auto flex max-w-content flex-col gap-3 px-gutter pt-4 pb-6 print:hidden"
		aria-label="Print"
	>
		<a
			href={resolve('/a/[token]/share', { token: data.game.admin_token })}
			class="flex min-h-touch items-center gap-2 self-start font-semibold underline underline-offset-2"
		>
			<ArrowLeftIcon aria-hidden="true" class="size-5" />
			Back to Share
		</a>
		<h1 class="type-title">Team QR codes</h1>
		<p>
			One card per team and one for the scoreboard, two to an A4 page. Cut them along the lines.
		</p>
		<Button variant="primary" class="self-start" onclick={() => window.print()}>
			<PrinterIcon aria-hidden="true" />
			Print
		</Button>
		{#if data.teams.length === 0}
			<p>No teams yet, so only the scoreboard card prints. Add teams in Setup first.</p>
		{/if}
	</header>

	<main
		class="mx-auto flex max-w-[180mm] flex-col gap-6 px-gutter pb-10 print:max-w-none print:gap-[4mm] print:p-0"
	>
		{#each cards as card (card.key)}
			<article
				class="card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black/40 p-6 text-center"
			>
				<p class="text-[15px]">{data.game.name}</p>
				<h2 class="font-display text-[28px] leading-tight font-bold break-words">{card.title}</h2>
				<QrCode
					text={card.url}
					label="QR code of the {card.title} link"
					class="w-full max-w-[85mm] rounded-none"
				/>
				<p class="text-[17px] font-semibold">{card.instruction}</p>
				{#if card.joinCode}
					<p class="text-[15px]">
						No camera? Go to {links.joinPage} and type
						<span class="block font-score text-[32px] font-extrabold tracking-wider"
							>{card.joinCode}</span
						>
					</p>
				{:else}
					<p class="text-[13px] break-all">{card.url}</p>
				{/if}
			</article>
		{/each}
	</main>
</div>

<style>
	@page {
		size: A4;
		margin: 12mm;
	}

	@media print {
		.card {
			box-sizing: border-box;
			height: 134mm;
			break-inside: avoid;
		}

		.card:nth-child(2n) {
			break-after: page;
		}

		.card:last-child {
			break-after: auto;
		}
	}
</style>
